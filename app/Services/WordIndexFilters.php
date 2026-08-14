<?php

namespace App\Services;

use App\Models\Folder;
use App\Models\User;
use App\Models\Word;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class WordIndexFilters
{
    private const ALLOWED_PER_PAGE = [20, 50, 100, 200, 300, 400, 500, 1000];

    private const DEFAULT_PER_PAGE = 50;

    private ?array $folderWordIds = null;

    private bool $folderWordIdsLoaded = false;

    public function __construct(
        private User $user,
        private string $search,
        private string $letter,
        private ?int $level,
        private string $status,
        private ?int $importance,
        private ?int $folderId,
        private string $source,
        private int $perPage,
    ) {}

    public static function fromRequest(Request $request): self
    {
        $perPage = (int) $request->input('per_page');

        return new self(
            user: $request->user(),
            search: $request->string('search')->trim()->lower()->value(),
            letter: $request->string('letter')->trim()->upper()->value(),
            level: $request->integer('level') ?: null,
            status: $request->string('status')->trim()->lower()->value(),
            importance: $request->integer('importance') ?: null,
            folderId: $request->integer('folder') ?: null,
            source: $request->string('source')->trim()->lower()->value() === 'custom' ? 'custom' : '',
            perPage: in_array($perPage, self::ALLOWED_PER_PAGE, true) ? $perPage : self::DEFAULT_PER_PAGE,
        );
    }

    public function perPage(): int
    {
        return $this->perPage;
    }

    public function toArray(): array
    {
        return [
            'search' => $this->search,
            'letter' => $this->letter,
            'level' => $this->level,
            'status' => $this->status,
            'importance' => $this->importance,
            'folder' => $this->folderId,
            'source' => $this->source,
            'per_page' => $this->perPage,
        ];
    }

    public function pivot(): QueryBuilder
    {
        return DB::table('user_word')->where('user_id', $this->user->id);
    }

    public function baseWithoutLetter(): Builder
    {
        $folderWordIds = $this->folderWordIds();

        return Word::query()
            ->when($this->search !== '', fn (Builder $q) => $q->whereRaw('word LIKE ? ESCAPE ?', ['%'.$this->likeEscape($this->search).'%', '\\']))
            ->when($this->level !== null, fn (Builder $q) => $q->where('level', $this->level))
            ->when($this->status !== '', fn (Builder $q) => $q->whereIn('id', $this->pivot()->where('status', $this->status)->select('word_id')))
            ->when($this->importance !== null, fn (Builder $q) => $q->whereIn('id', $this->pivot()->where('importance', $this->importance)->select('word_id')))
            ->when($folderWordIds !== null, fn (Builder $q) => $q->whereIn('id', $folderWordIds));
    }

    public function baseQuery(): Builder
    {
        return $this->baseWithoutLetter()
            ->when(
                $this->search === '' && $this->letter !== '' && $this->letter !== 'ALL',
                fn (Builder $q) => $q->whereRaw('word LIKE ? ESCAPE ?', [$this->likeEscape($this->letter).'%', '\\'])
            );
    }

    public function markedIds(): Collection
    {
        return $this->pivot()->pluck('word_id');
    }

    public function orderedIds(): Collection
    {
        return $this->baseQuery()->orderBy('rank')->pluck('id')->values();
    }

    public function markedLetters(): array
    {
        return $this->baseWithoutLetter()
            ->whereIn('id', $this->pivot()->select('word_id'))
            ->selectRaw('UPPER(SUBSTR(word, 1, 1)) as letter')
            ->distinct()
            ->pluck('letter')
            ->all();
    }

    public function customWords(): EloquentCollection
    {
        if ($this->folderId !== null) {
            return new EloquentCollection;
        }

        return $this->user->customWords()
            ->when($this->search !== '', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', ['%'.$this->likeEscape($this->search).'%', '\\']))
            ->when($this->letter !== '' && $this->letter !== 'ALL', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', [$this->likeEscape($this->letter).'%', '\\']))
            ->when($this->status !== '', fn ($q) => $q->where('status', $this->status))
            ->when($this->importance !== null, fn ($q) => $q->where('importance', $this->importance))
            ->get([
                'id',
                'word',
                'meaning_hu',
                'extra_meanings',
                'synonyms',
                'part_of_speech',
                'example_en',
                'example_hu',
                'status',
                'importance',
                'form_base',
                'verb_past',
                'verb_past_participle',
                'verb_present_participle',
                'verb_third_person',
                'is_irregular',
                'noun_plural',
                'adj_comparative',
                'adj_superlative',
                'extra_forms',
            ]);
    }

    private function folderWordIds(): ?array
    {
        if ($this->folderWordIdsLoaded) {
            return $this->folderWordIds;
        }

        $this->folderWordIdsLoaded = true;

        if ($this->folderId !== null) {
            $this->folderWordIds = Folder::where('id', $this->folderId)
                ->where('user_id', $this->user->id)
                ->first()
                ?->words()
                ->pluck('words.id')
                ->all() ?? [];
        }

        return $this->folderWordIds;
    }

    private function likeEscape(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
