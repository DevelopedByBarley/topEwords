<?php

namespace App\Http\Controllers;

use App\Models\FlashcardDeck;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class FlashcardCsvController extends Controller
{
    private const MAX_IMPORT_ROWS = 5000;

    /**
     * Per-field character cap, matching the max:10000 enforced on front/back by
     * the web editor and the extension API. Without it a CSV cell could exceed
     * the TEXT column (64 KB) and abort the whole import transaction.
     */
    private const MAX_FIELD_LENGTH = 10000;

    public function import(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $request->validate([
            'csv_file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
            'direction' => ['nullable', 'in:front_to_back,back_to_front,both'],
        ]);

        $direction = $request->input('direction') ?? 'front_to_back';

        $path = $request->file('csv_file')->getRealPath();
        $handle = fopen($path, 'r');

        // Skip BOM if present
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        $now = now();
        $rows = [];
        $skipped = 0;
        $truncated = false;

        while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
            if (count($rows) >= self::MAX_IMPORT_ROWS) {
                $truncated = true;
                break;
            }

            if (count($row) < 2) {
                $skipped++;

                continue;
            }

            $front = trim($row[0]);
            $back = trim($row[1]);

            if ($front === '' && $back === '') {
                $skipped++;

                continue;
            }

            if (mb_strlen($front) > self::MAX_FIELD_LENGTH || mb_strlen($back) > self::MAX_FIELD_LENGTH) {
                $skipped++;

                continue;
            }

            $rows[] = [
                'deck_id' => $deck->id,
                'front' => $this->textToHtml($front),
                'back' => $this->textToHtml($back),
                'direction' => $direction,
                'is_imported' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        fclose($handle);

        // A kártyakeret-kapu és az insert egy user-szintű zár alatt fut, hogy
        // párhuzamos importok ne mehessenek át ugyanazon az elavult kártyaszámon
        // (SEC_AUDIT #R10).
        $withinLimit = Cache::lock("plan-limit:flashcards:{$request->user()->id}", 15)
            ->block(10, function () use ($request, $rows, $deck): bool {
                if (! $request->user()->canAddFlashcards(count($rows))) {
                    return false;
                }

                DB::transaction(function () use ($rows, $deck) {
                    foreach (array_chunk($rows, 500) as $chunk) {
                        $deck->flashcards()->insert($chunk);
                    }
                });

                return true;
            });

        if (! $withinLimit) {
            $limit = $request->user()->planLimit('flashcards');

            return back()->with('error', "Elérted a csomagod kártyakeretét (összesen {$limit} kártya). Válts magasabb csomagra a folytatáshoz.");
        }

        $imported = count($rows);
        $message = "{$imported} kártya importálva";
        if ($skipped > 0) {
            $message .= ", {$skipped} kihagyva";
        }
        if ($truncated) {
            $message .= ' (a fájl több mint '.self::MAX_IMPORT_ROWS.' sort tartalmazott, a többi nem került be)';
        }

        return to_route('flashcards.show', $deck)
            ->with('success', $message.'.')
            ->with('calibration_prompt', $imported);
    }

    public function export(Request $request, FlashcardDeck $deck): Response
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $flashcards = $deck->flashcards()->orderBy('id')->get(['front', 'back', 'front_notes', 'back_notes']);

        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $deck->name).'.csv';

        $csv = "\xEF\xBB\xBF"; // UTF-8 BOM for Excel
        $csv .= "front,back,front_notes,back_notes\n";

        foreach ($flashcards as $card) {
            $csv .= $this->csvRow([
                $this->stripHtml($card->front),
                $this->stripHtml($card->back),
                $this->stripHtml($card->front_notes ?? ''),
                $this->stripHtml($card->back_notes ?? ''),
            ]);
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    private function textToHtml(string $text): string
    {
        // Strip Anki cloze deletion syntax: {{c1::text}} → text
        $text = preg_replace('/\{\{c\d+::(.+?)\}\}/s', '$1', $text) ?? $text;

        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [$text];
        $html = '';

        foreach ($lines as $line) {
            $escaped = htmlspecialchars($line, ENT_QUOTES, 'UTF-8');
            $html .= '<p>'.($escaped !== '' ? $escaped : '').'</p>';
        }

        return $html;
    }

    private function stripHtml(?string $html): string
    {
        if ($html === null || $html === '') {
            return '';
        }

        return trim(html_entity_decode(strip_tags($html), ENT_QUOTES, 'UTF-8'));
    }

    private function csvRow(array $fields): string
    {
        $escaped = array_map(function (string $field): string {
            // Formula injection elleni védelem: Excel a =,+,-,@ kezdetű cellákat képletként futtatná
            if ($field !== '' && in_array($field[0], ['=', '+', '-', '@'], true)) {
                $field = "'".$field;
            }

            $field = str_replace('"', '""', $field);

            return '"'.$field.'"';
        }, $fields);

        return implode(',', $escaped)."\n";
    }
}
