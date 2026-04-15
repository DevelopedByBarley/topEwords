<?php

namespace App\Http\Controllers;

use App\Models\FlashcardDeck;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class FlashcardCsvController extends Controller
{
    public function import(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $request->validate([
            'csv_file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $path = $request->file('csv_file')->getRealPath();
        $handle = fopen($path, 'r');

        // Skip BOM if present
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }

        $imported = 0;
        $skipped = 0;

        while (($row = fgetcsv($handle)) !== false) {
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

            $deck->flashcards()->create([
                'front' => $this->textToHtml($front),
                'back' => $this->textToHtml($back),
                'direction' => 'both',
                'is_imported' => true,
            ]);

            $imported++;
        }

        fclose($handle);

        $message = "{$imported} kártya importálva";
        if ($skipped > 0) {
            $message .= ", {$skipped} kihagyva";
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
            $field = str_replace('"', '""', $field);

            return '"'.$field.'"';
        }, $fields);

        return implode(',', $escaped)."\n";
    }
}
