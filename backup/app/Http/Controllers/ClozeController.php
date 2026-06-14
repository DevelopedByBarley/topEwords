<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClozeController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->string('status')->trim()->lower()->value();
        $difficulty = $request->string('difficulty')->trim()->lower()->value();
        $folderId = $request->integer('folder') ?: null;
        $user = $request->user();
        $freeClozeLimit = 5;
        $maxCount = $user->hasActiveAccess() ? 500 : $freeClozeLimit;
        $count = min(max((int) $request->input('count', 0), 0), $maxCount);

        // Parse comma-separated ids param for manual word selection
        $idsParam = $request->string('ids')->trim()->value();
        $selectedIds = $idsParam !== '' ? array_filter(array_map('trim', explode(',', $idsParam))) : [];
        if (! $user->hasActiveAccess() && count($selectedIds) > $freeClozeLimit) {
            $selectedIds = array_slice($selectedIds, 0, $freeClozeLimit);
        }
        $selectedRegularIds = array_values(array_map('intval', array_filter($selectedIds, fn ($id) => ! str_starts_with($id, 'custom_'))));
        $selectedCustomIds = array_values(array_map(fn ($id) => (int) substr($id, 7), array_filter($selectedIds, fn ($id) => str_starts_with($id, 'custom_'))));

        $wordStatuses = $user->knownWords()
            ->pluck('user_word.status', 'words.id')
            ->all();

        $folders = $user->folders()->withCount('words')->get()
            ->map(fn (Folder $folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'words_count' => $folder->words_count,
            ]);

        $folderWordIds = $folderId !== null
            ? Folder::where('id', $folderId)->where('user_id', $user->id)
                ->first()
                ?->words()
                ->pluck('words.id')
                ->all() ?? []
            : null;

        $query = Word::whereNotNull('example_en')->where('example_en', '!=', '');

        if (in_array($status, ['known', 'learning', 'saved', 'pronunciation'])) {
            $ids = array_keys(array_filter($wordStatuses, fn ($s) => $s === $status));
            $query->whereIn('id', $ids);
        } elseif ($status === 'marked') {
            $query->whereIn('id', array_keys($wordStatuses));
        }

        if ($difficulty === 'beginner') {
            $query->whereBetween('rank', [1, 2000]);
        } elseif ($difficulty === 'intermediate') {
            $query->whereBetween('rank', [2001, 6000]);
        } elseif ($difficulty === 'advanced') {
            $query->whereBetween('rank', [6001, 10000]);
        }

        if ($folderWordIds !== null) {
            $query->whereIn('id', $folderWordIds);
        }

        $includeCustom = $difficulty === '' && $folderWordIds === null;
        $customWordQuery = $includeCustom
            ? UserCustomWord::where('user_id', $user->id)
                ->whereNotNull('example_en')
                ->where('example_en', '!=', '')
            : null;

        if ($customWordQuery && in_array($status, ['known', 'learning', 'saved', 'pronunciation'])) {
            $customWordQuery->where('status', $status);
        }

        $customAvailable = $customWordQuery?->count() ?? 0;
        $available = $query->count() + $customAvailable;

        // In setup mode: return selectable word list
        $selectableWords = [];
        if ($count === 0 && count($selectedIds) === 0) {
            $regularSelectable = (clone $query)
                ->orderBy('rank')
                ->limit(500)
                ->get(['id', 'word', 'meaning_hu', 'rank'])
                ->map(fn (Word $w) => [
                    'id' => $w->id,
                    'word' => $w->word,
                    'meaning_hu' => $w->meaning_hu,
                    'rank' => $w->rank,
                    'status' => $wordStatuses[$w->id] ?? null,
                    'is_custom' => false,
                ]);

            $customSelectable = $customWordQuery
                ? (clone $customWordQuery)->orderBy('word')->limit(200)->get(['id', 'word', 'meaning_hu', 'status'])
                    ->map(fn (UserCustomWord $w) => [
                        'id' => 'custom_'.$w->id,
                        'word' => $w->word,
                        'meaning_hu' => $w->meaning_hu,
                        'rank' => null,
                        'status' => $w->status,
                        'is_custom' => true,
                    ])
                : collect();

            $selectableWords = $regularSelectable->concat($customSelectable)->values()->all();
        }

        $items = [];
        $useSelectedIds = count($selectedIds) > 0;

        if ($useSelectedIds || ($count > 0 && $available > 0)) {
            if ($useSelectedIds) {
                $regularWords = count($selectedRegularIds) > 0
                    ? Word::whereIn('id', $selectedRegularIds)
                        ->get(['id', 'word', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative', 'meaning_hu', 'example_en', 'example_hu', 'rank', 'part_of_speech'])
                    : collect();

                $customWords = count($selectedCustomIds) > 0
                    ? UserCustomWord::where('user_id', $user->id)->whereIn('id', $selectedCustomIds)
                        ->get(['id', 'word', 'meaning_hu', 'example_en', 'example_hu', 'status'])
                    : collect();
            } else {
                $customShare = $available > 0 ? (int) round($count * ($customAvailable / $available)) : 0;
                $regularShare = $count - $customShare;

                $regularWords = (clone $query)
                    ->inRandomOrder()
                    ->limit($regularShare)
                    ->get(['id', 'word', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative', 'meaning_hu', 'example_en', 'example_hu', 'rank', 'part_of_speech']);

                $customWords = $customWordQuery
                    ? (clone $customWordQuery)->inRandomOrder()->limit($customShare)->get(['id', 'word', 'meaning_hu', 'example_en', 'example_hu', 'status'])
                    : collect();
            }

            foreach ($regularWords as $word) {
                $cloze = $this->makeCloze($word->example_en, array_filter([
                    $word->word,
                    $word->form_base,
                    $word->verb_past,
                    $word->verb_past_participle,
                    $word->verb_present_participle,
                    $word->verb_third_person,
                    $word->noun_plural,
                    $word->adj_comparative,
                    $word->adj_superlative,
                ]));

                if ($cloze === null) {
                    continue;
                }

                $items[] = [
                    'id' => $word->id,
                    'word' => $word->word,
                    'meaning_hu' => $word->meaning_hu,
                    'example_hu' => $word->example_hu,
                    'rank' => $word->rank,
                    'part_of_speech' => $word->part_of_speech,
                    'status' => $wordStatuses[$word->id] ?? null,
                    'sentence' => $cloze['sentence'],
                    'answer' => $cloze['answer'],
                    'is_custom' => false,
                ];
            }

            foreach ($customWords as $cw) {
                $cloze = $this->makeCloze($cw->example_en, [$cw->word]);

                if ($cloze === null) {
                    continue;
                }

                $items[] = [
                    'id' => 'custom_'.$cw->id,
                    'word' => $cw->word,
                    'meaning_hu' => $cw->meaning_hu,
                    'example_hu' => $cw->example_hu ?? null,
                    'rank' => null,
                    'part_of_speech' => null,
                    'status' => $cw->status,
                    'sentence' => $cloze['sentence'],
                    'answer' => $cloze['answer'],
                    'is_custom' => true,
                ];
            }

            shuffle($items);
        }

        return Inertia::render('words/cloze', [
            'items' => $items,
            'available' => $available,
            'folders' => $folders,
            'selectableWords' => $selectableWords,
            'filters' => [
                'status' => $status,
                'difficulty' => $difficulty,
                'folder' => $folderId,
                'count' => $count,
            ],
            'freeClozeLimit' => $user->hasActiveAccess() ? null : $freeClozeLimit,
        ]);
    }

    /**
     * Find the first matching word form in the sentence and replace it with _____.
     *
     * @param  array<string>  $forms
     * @return array{sentence: string, answer: string}|null
     */
    private function makeCloze(string $example, array $forms): ?array
    {
        foreach ($forms as $form) {
            if (empty($form)) {
                continue;
            }

            $pattern = '/\b'.preg_quote($form, '/').'\b/iu';

            if (preg_match($pattern, $example, $matches)) {
                $answer = mb_strtolower($matches[0]);
                $sentence = preg_replace($pattern, '_____', $example, 1);

                return ['sentence' => $sentence, 'answer' => $answer];
            }
        }

        return null;
    }
}
