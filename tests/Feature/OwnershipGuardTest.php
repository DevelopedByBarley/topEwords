<?php

/*
 * T-3 + T-12 (audit-2026-09): őrző tesztek a teljes IDOR-felületre.
 *
 * A tulajdonos-ellenőrzés ma kézzel, a controllerek `abort_unless(...)` / `Gate::authorize`
 * soraiban történik (nincs scopeBindings, a legtöbb modellhez nincs policy). Ez a fájl
 * minden felhasználói erőforrást átvevő route-ot végigpróbál egy idegen felhasználóval,
 * és ellenőrzi, hogy (1) a válasz a várt 403/404, (2) a sértett adata bitre változatlan,
 * (3) a tulajdonos viszont sikerrel eléri. A szerkezeti háló (utolsó teszt) elbukik, ha
 * új, paramétert átvevő route jelenik meg, ami itt nincs lefedve.
 */

use App\Models\BillingoInvoice;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardFolder;
use App\Models\FlashcardReview;
use App\Models\Folder;
use App\Models\Invite;
use App\Models\Report;
use App\Models\User;
use App\Models\UserBook;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Models\YoutubeTranscript;
use App\Services\Billingo\BillingoClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Egy felhasználó teljes, route-okon elérhető erőforrás-készlete.
 *
 * @return array{user: User, deck: FlashcardDeck, targetDeck: FlashcardDeck, card: Flashcard, folder: Folder, word: Word, flashcardFolder: FlashcardFolder, customWord: UserCustomWord, book: UserBook, transcript: YoutubeTranscript, invoice: BillingoInvoice, tokenId: int, invite: Invite, report: Report}
 */
function ownershipGuardFixtures(User $user): array
{
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'VICTIM DECK '.$user->id]);
    $targetDeck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'TARGET DECK '.$user->id]);

    $card = Flashcard::create([
        'deck_id' => $deck->id,
        'front' => 'SECRET FRONT',
        'back' => 'SECRET BACK',
        'direction' => 'front_to_back',
    ]);
    FlashcardReview::create([
        'flashcard_id' => $card->id,
        'direction' => 'front_to_back',
        'state' => 'learning',
        'due_at' => now()->subMinute(),
        'previous_state' => ['state' => 'new'],
    ]);

    $word = Word::create(['word' => 'ownershipword'.$user->id, 'rank' => 90000 + $user->id]);

    $folder = Folder::factory()->for($user)->create(['name' => 'VICTIM FOLDER '.$user->id]);
    $folder->words()->attach($word->id);
    $user->knownWords()->attach($word->id, ['status' => 'learning']);

    $flashcardFolder = $user->flashcardFolders()->create(['name' => 'VICTIM FF '.$user->id]);
    $flashcardFolder->decks()->attach($deck->id);

    $customWord = $user->customWords()->create(['word' => 'victimword'.$user->id, 'meaning_hu' => 'áldozat']);

    $text = 'the quick dog';
    $book = UserBook::create([
        'user_id' => $user->id,
        'title' => 'VICTIM BOOK',
        'file_type' => 'pdf',
        'compressed_text' => gzencode($text, 6),
        'total_pages' => 1,
        'text_size' => strlen($text),
    ]);

    $transcript = YoutubeTranscript::create([
        'user_id' => $user->id,
        'video_id' => 'abcdefghijk',
        'title' => 'VICTIM YT',
        'compressed_segments' => gzencode(json_encode([['t' => 0, 'x' => $text]]), 6),
        'total_pages' => 1,
        'text_size' => strlen($text),
    ]);

    $invoice = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_guard_'.$user->id,
        'billingo_document_id' => 5000 + $user->id,
        'invoice_number' => 'TESZT/'.$user->id,
    ]);

    $tokenId = $user->createToken('topwords Player – Gép', ['player'])->accessToken->id;

    return [
        'user' => $user,
        'deck' => $deck,
        'targetDeck' => $targetDeck,
        'card' => $card,
        'folder' => $folder,
        'word' => $word,
        'flashcardFolder' => $flashcardFolder,
        'customWord' => $customWord,
        'book' => $book,
        'transcript' => $transcript,
        'invoice' => $invoice,
        'tokenId' => $tokenId,
        'invite' => Invite::create(['code' => 'GUARD'.$user->id, 'max_uses' => 1]),
        'report' => Report::factory()->for($user)->create(),
    ];
}

/**
 * A felhasználóhoz tartozó összes sor pillanatképe — egy támadás után ennek bitre
 * változatlannak kell lennie.
 *
 * @param  array<string, mixed>  $fixtures
 * @return array<string, array<int, mixed>>
 */
function ownershipGuardSnapshot(array $fixtures): array
{
    $user = $fixtures['user'];
    $deckIds = DB::table('flashcard_decks')->where('user_id', $user->id)->pluck('id');
    $cardIds = DB::table('flashcards')->whereIn('deck_id', $deckIds)->pluck('id');
    $folderIds = DB::table('folders')->where('user_id', $user->id)->pluck('id');
    $flashcardFolderIds = DB::table('flashcard_folders')->where('user_id', $user->id)->pluck('id');

    $rows = fn (string $table, string $column, mixed $values): array => DB::table($table)
        ->whereIn($column, collect($values)->all())
        ->get()
        ->map(fn ($row) => (array) $row)
        ->sortBy(fn (array $row) => json_encode($row))
        ->values()
        ->all();

    return [
        'users' => $rows('users', 'id', [$user->id]),
        'flashcard_decks' => $rows('flashcard_decks', 'id', $deckIds),
        'flashcards' => $rows('flashcards', 'id', $cardIds),
        'flashcard_reviews' => $rows('flashcard_reviews', 'flashcard_id', $cardIds),
        'flashcard_deck_settings' => $rows('flashcard_deck_settings', 'flashcard_deck_id', $deckIds),
        'flashcard_settings' => $rows('flashcard_settings', 'user_id', [$user->id]),
        'flashcard_folders' => $rows('flashcard_folders', 'id', $flashcardFolderIds),
        'flashcard_deck_folder' => $rows('flashcard_deck_folder', 'flashcard_folder_id', $flashcardFolderIds),
        'flashcard_deck_folder_by_deck' => $rows('flashcard_deck_folder', 'flashcard_deck_id', $deckIds),
        'folders' => $rows('folders', 'id', $folderIds),
        'folder_word' => $rows('folder_word', 'folder_id', $folderIds),
        'user_word' => $rows('user_word', 'user_id', [$user->id]),
        'user_custom_words' => $rows('user_custom_words', 'user_id', [$user->id]),
        'user_books' => $rows('user_books', 'user_id', [$user->id]),
        'youtube_transcripts' => $rows('youtube_transcripts', 'user_id', [$user->id]),
        'billingo_invoices' => $rows('billingo_invoices', 'user_id', [$user->id]),
        'personal_access_tokens' => $rows('personal_access_tokens', 'tokenable_id', [$user->id]),
        'reports' => $rows('reports', 'user_id', [$user->id]),
        'invites' => $rows('invites', 'id', [$fixtures['invite']->id]),
        'words' => $rows('words', 'id', [$fixtures['word']->id]),
    ];
}

/**
 * Érvényes pakli-beállítás payload (a FormRequest a controller-ellenőrzés ELŐTT fut,
 * ezért hiányos payloaddal 422 jönne 403 helyett — lásd 03-adat-es-jog.md).
 *
 * @return array<string, mixed>
 */
function ownershipGuardDeckSettingsPayload(): array
{
    return [
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10],
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 36500,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
        'shuffle_cards' => 1,
    ];
}

/**
 * Az összes lefedett eset.
 *
 * - `route`: "METHOD uri" — ez köti az esetet a route-listához (szerkezeti háló).
 * - `attack`: a várt státusz, ha a `target` (URL-ben szereplő) erőforrás egy másik
 *   felhasználóé, a kérést pedig az `actor` küldi a saját erőforrásaival a payloadban.
 * - `owner`: a tulajdonos sikeres elérését is ellenőrizzük-e (target === actor).
 * - `request`: fn (target, actor) => [method, url, payload].
 *
 * @return array<string, array{route: string, attack: int, owner: bool, request: Closure(array<string, mixed>, array<string, mixed>): array{0: string, 1: string, 2: array<string, mixed>}}>
 */
function ownershipGuardCases(): array
{
    $case = fn (string $route, int $attack, bool $owner, Closure $request): array => compact('route', 'attack', 'owner', 'request');

    return [
        // --- Paklik: FlashcardDeckController ---
        'deck show' => $case('GET flashcards/{deck}', 403, true,
            fn ($t, $a) => ['GET', route('flashcards.show', $t['deck']), []]),
        'deck update' => $case('PATCH flashcards/{deck}', 403, true,
            fn ($t, $a) => ['PATCH', route('flashcards.update', $t['deck']), ['name' => 'HACKED', 'description' => 'x']]),
        'deck destroy' => $case('DELETE flashcards/{deck}', 403, true,
            fn ($t, $a) => ['DELETE', route('flashcards.destroy', $t['deck']), []]),
        'deck settings update' => $case('PUT flashcards/{deck}/settings', 403, true,
            fn ($t, $a) => ['PUT', route('flashcards.settings.update', $t['deck']), ownershipGuardDeckSettingsPayload()]),
        'deck settings destroy' => $case('DELETE flashcards/{deck}/settings', 403, true,
            fn ($t, $a) => ['DELETE', route('flashcards.settings.destroy', $t['deck']), []]),

        // --- Kalibráció, tanulás, CSV ---
        'calibrate show' => $case('GET flashcards/{deck}/calibrate', 403, true,
            fn ($t, $a) => ['GET', route('flashcards.calibrate', $t['deck']), []]),
        'calibrate rate' => $case('POST flashcards/{deck}/calibrate', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.calibrate.rate', $t['deck']), [
                'flashcard_id' => $t['card']->id, 'rating' => 3, 'direction' => 'front_to_back', 'is_last_direction' => 1,
            ]]),
        'calibrate skip' => $case('POST flashcards/{deck}/calibrate/skip', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.calibrate.skip', $t['deck']), []]),
        'study show' => $case('GET flashcards/{deck}/study', 403, true,
            fn ($t, $a) => ['GET', route('flashcards.study', $t['deck']), []]),
        'study submit' => $case('POST flashcards/{deck}/study', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.study.submit', $t['deck']), [
                'flashcard_id' => $t['card']->id, 'direction' => 'front_to_back', 'rating' => 3,
            ]]),
        'study undo' => $case('POST flashcards/{deck}/study/undo', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.study.undo', $t['deck']), [
                'flashcard_id' => $t['card']->id, 'direction' => 'front_to_back',
            ]]),
        'csv export' => $case('GET flashcards/{deck}/csv-export', 403, true,
            fn ($t, $a) => ['GET', route('flashcards.csv.export', $t['deck']), []]),
        'csv import' => $case('POST flashcards/{deck}/csv-import', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.csv.import', $t['deck']), [
                'csv_file' => UploadedFile::fake()->createWithContent('cards.csv', "front,back\nhello,szia\n"),
            ]]),

        // --- Kártyák: FlashcardCardController ---
        'card store' => $case('POST flashcards/{deck}/cards', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.store', $t['deck']), [
                'front' => 'INJECTED', 'back' => 'INJECTED', 'direction' => 'front_to_back',
            ]]),
        'card import from word' => $case('POST flashcards/{deck}/cards/import', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.import', $t['deck']), ['word_id' => $a['word']->id]]),
        'card update' => $case('PATCH flashcards/{deck}/cards/{flashcard}', 403, true,
            fn ($t, $a) => ['PATCH', route('flashcards.cards.update', [$t['deck'], $t['card']]), [
                'front' => 'HACKED', 'back' => 'HACKED', 'direction' => 'front_to_back',
            ]]),
        'card destroy' => $case('DELETE flashcards/{deck}/cards/{flashcard}', 403, true,
            fn ($t, $a) => ['DELETE', route('flashcards.cards.destroy', [$t['deck'], $t['card']]), []]),
        'card duplicate' => $case('POST flashcards/{deck}/cards/{flashcard}/duplicate', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.duplicate', [$t['deck'], $t['card']]), []]),
        'card move' => $case('POST flashcards/{deck}/cards/{flashcard}/move', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.move', [$t['deck'], $t['card']]), [
                'target_deck_id' => $a['targetDeck']->id, 'reset_progress' => 1,
            ]]),
        'card reset' => $case('POST flashcards/{deck}/cards/{flashcard}/reset', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.reset', [$t['deck'], $t['card']]), []]),
        'cards bulk delete' => $case('POST flashcards/{deck}/cards/bulk-delete', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-delete', $t['deck']), ['ids' => [$t['card']->id]]]),
        'cards bulk reset' => $case('POST flashcards/{deck}/cards/bulk-reset', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-reset', $t['deck']), ['ids' => [$t['card']->id]]]),
        'cards bulk reverse' => $case('POST flashcards/{deck}/cards/bulk-reverse', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-reverse', $t['deck']), ['ids' => [$t['card']->id]]]),
        'cards bulk direction' => $case('POST flashcards/{deck}/cards/bulk-direction', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-direction', $t['deck']), [
                'ids' => [$t['card']->id], 'direction' => 'both',
            ]]),
        'cards bulk move' => $case('POST flashcards/{deck}/cards/bulk-move', 403, true,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-move', $t['deck']), [
                'ids' => [$t['card']->id], 'target_deck_id' => $a['targetDeck']->id, 'reset_progress' => 1,
            ]]),

        // --- Szülő-gyerek keverés: SAJÁT pakli + IDEGEN kártya / cél / payload-azonosító ---
        'card update via own deck' => $case('PATCH flashcards/{deck}/cards/{flashcard}', 403, false,
            fn ($t, $a) => ['PATCH', route('flashcards.cards.update', [$a['deck'], $t['card']]), [
                'front' => 'HACKED', 'back' => 'HACKED', 'direction' => 'front_to_back',
            ]]),
        'card destroy via own deck' => $case('DELETE flashcards/{deck}/cards/{flashcard}', 403, false,
            fn ($t, $a) => ['DELETE', route('flashcards.cards.destroy', [$a['deck'], $t['card']]), []]),
        'card duplicate via own deck' => $case('POST flashcards/{deck}/cards/{flashcard}/duplicate', 403, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.duplicate', [$a['deck'], $t['card']]), []]),
        'card move via own deck' => $case('POST flashcards/{deck}/cards/{flashcard}/move', 403, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.move', [$a['deck'], $t['card']]), [
                'target_deck_id' => $a['targetDeck']->id,
            ]]),
        'card reset via own deck' => $case('POST flashcards/{deck}/cards/{flashcard}/reset', 403, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.reset', [$a['deck'], $t['card']]), []]),
        'own card moved into foreign deck' => $case('POST flashcards/{deck}/cards/{flashcard}/move', 403, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.move', [$a['deck'], $a['card']]), [
                'target_deck_id' => $t['deck']->id,
            ]]),
        'own cards bulk moved into foreign deck' => $case('POST flashcards/{deck}/cards/bulk-move', 403, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-move', $a['deck']), [
                'ids' => [$a['card']->id], 'target_deck_id' => $t['deck']->id,
            ]]),
        'foreign ids bulk deleted via own deck' => $case('POST flashcards/{deck}/cards/bulk-delete', 302, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-delete', $a['deck']), ['ids' => [$t['card']->id]]]),
        'foreign ids bulk reset via own deck' => $case('POST flashcards/{deck}/cards/bulk-reset', 302, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-reset', $a['deck']), ['ids' => [$t['card']->id]]]),
        'foreign ids bulk reversed via own deck' => $case('POST flashcards/{deck}/cards/bulk-reverse', 302, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-reverse', $a['deck']), ['ids' => [$t['card']->id]]]),
        'foreign ids bulk direction via own deck' => $case('POST flashcards/{deck}/cards/bulk-direction', 302, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-direction', $a['deck']), [
                'ids' => [$t['card']->id], 'direction' => 'both',
            ]]),
        'foreign ids bulk moved via own deck' => $case('POST flashcards/{deck}/cards/bulk-move', 302, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.bulk-move', $a['deck']), [
                'ids' => [$t['card']->id], 'target_deck_id' => $a['targetDeck']->id, 'reset_progress' => 1,
            ]]),
        'foreign custom word imported into own deck' => $case('POST flashcards/{deck}/cards/import', 404, false,
            fn ($t, $a) => ['POST', route('flashcards.cards.import', $a['deck']), ['custom_word_id' => $t['customWord']->id]]),
        'foreign card studied via own deck' => $case('POST flashcards/{deck}/study', 404, false,
            fn ($t, $a) => ['POST', route('flashcards.study.submit', $a['deck']), [
                'flashcard_id' => $t['card']->id, 'direction' => 'front_to_back', 'rating' => 3,
            ]]),
        'foreign card undone via own deck' => $case('POST flashcards/{deck}/study/undo', 404, false,
            fn ($t, $a) => ['POST', route('flashcards.study.undo', $a['deck']), [
                'flashcard_id' => $t['card']->id, 'direction' => 'front_to_back',
            ]]),
        'foreign card calibrated via own deck' => $case('POST flashcards/{deck}/calibrate', 404, false,
            fn ($t, $a) => ['POST', route('flashcards.calibrate.rate', $a['deck']), [
                'flashcard_id' => $t['card']->id, 'rating' => 3, 'direction' => 'front_to_back', 'is_last_direction' => 1,
            ]]),

        // --- Kártya-mappák ---
        'flashcard folder update' => $case('PATCH flashcards/folders/{flashcardFolder}', 403, true,
            fn ($t, $a) => ['PATCH', route('flashcards.folders.update', $t['flashcardFolder']), ['name' => 'HACKED']]),
        'flashcard folder destroy' => $case('DELETE flashcards/folders/{flashcardFolder}', 403, true,
            fn ($t, $a) => ['DELETE', route('flashcards.folders.destroy', $t['flashcardFolder']), []]),
        'flashcard folder deck toggle' => $case('PATCH flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}', 403, true,
            fn ($t, $a) => ['PATCH', route('flashcards.folders.decks.update', [$t['flashcardFolder'], $t['deck']]), ['in_folder' => 0]]),
        'foreign deck put into own flashcard folder' => $case('PATCH flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}', 403, false,
            fn ($t, $a) => ['PATCH', route('flashcards.folders.decks.update', [$a['flashcardFolder'], $t['deck']]), ['in_folder' => 1]]),
        'own deck put into foreign flashcard folder' => $case('PATCH flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}', 403, false,
            fn ($t, $a) => ['PATCH', route('flashcards.folders.decks.update', [$t['flashcardFolder'], $a['deck']]), ['in_folder' => 1]]),

        // --- Szó-mappák ---
        'folder update' => $case('PATCH folders/{folder}', 403, true,
            fn ($t, $a) => ['PATCH', route('folders.update', $t['folder']), ['name' => 'HACKED']]),
        'folder destroy' => $case('DELETE folders/{folder}', 403, true,
            fn ($t, $a) => ['DELETE', route('folders.destroy', $t['folder']), []]),
        'folder word toggle' => $case('PATCH folders/{folder}/words/{word}', 403, true,
            fn ($t, $a) => ['PATCH', route('folders.words.update', [$t['folder'], $t['word']]), ['in_folder' => 0]]),

        // --- Saját szavak ---
        'custom word update' => $case('PATCH custom-words/{customWord}', 403, true,
            fn ($t, $a) => ['PATCH', route('custom-words.update', $t['customWord']), ['meaning_hu' => 'HACKED']]),
        'custom word destroy' => $case('DELETE custom-words/{customWord}', 403, true,
            fn ($t, $a) => ['DELETE', route('custom-words.destroy', $t['customWord']), []]),
        'custom word status' => $case('POST custom-words/{customWord}/status', 403, true,
            fn ($t, $a) => ['POST', route('custom-words.status', $t['customWord']), ['status' => 'known']]),
        'custom word importance' => $case('POST custom-words/{customWord}/importance', 403, true,
            fn ($t, $a) => ['POST', route('custom-words.importance', $t['customWord']), ['importance' => 5]]),

        // --- Globális szótár-szó: a státusz/fontosság a KÉRŐ saját pivotját írja ---
        'word status only touches own pivot' => $case('POST words/{word}/status', 200, true,
            fn ($t, $a) => ['POST', route('words.status', $t['word']), ['status' => 'known']]),
        'word importance only touches own pivot' => $case('POST words/{word}/importance', 200, true,
            fn ($t, $a) => ['POST', route('words.importance', $t['word']), ['importance' => 5]]),

        // --- Szövegelemzés: könyvek, YouTube ---
        'book page' => $case('GET text-analysis/books/{book}/page', 403, true,
            fn ($t, $a) => ['GET', route('text-analysis.books.page', $t['book']), []]),
        'book overview' => $case('GET text-analysis/books/{book}/overview', 403, true,
            fn ($t, $a) => ['GET', route('text-analysis.books.overview', $t['book']), []]),
        'book destroy' => $case('DELETE text-analysis/books/{book}', 403, true,
            fn ($t, $a) => ['DELETE', route('text-analysis.books.destroy', $t['book']), []]),
        'youtube page' => $case('GET text-analysis/youtube/{transcript}/page', 403, true,
            fn ($t, $a) => ['GET', route('text-analysis.youtube.page', $t['transcript']), []]),
        'youtube overview' => $case('GET text-analysis/youtube/{transcript}/overview', 403, true,
            fn ($t, $a) => ['GET', route('text-analysis.youtube.overview', $t['transcript']), []]),
        'youtube destroy' => $case('DELETE text-analysis/youtube/{transcript}', 403, true,
            fn ($t, $a) => ['DELETE', route('text-analysis.youtube.destroy', $t['transcript']), []]),

        // --- Beállítások: számla (404, nem enumerálható), lejátszó-token (user-scoped no-op) ---
        'invoice download' => $case('GET settings/subscription/invoices/{invoice}', 404, true,
            fn ($t, $a) => ['GET', route('subscription.invoice.download', $t['invoice']), []]),
        'player device revoke' => $case('DELETE settings/security/player-devices/{tokenId}', 302, true,
            fn ($t, $a) => ['DELETE', route('security.player-devices.destroy', ['tokenId' => $t['tokenId']]), []]),

        // --- Admin-kapus route-ok: sima felhasználónak 403, bármely azonosítóval ---
        'admin free month' => $case('POST admin/free-month/{user}', 403, false,
            fn ($t, $a) => ['POST', route('admin.free-month.grant', $t['user']->email), []]),
        'admin invite destroy' => $case('DELETE admin/invites/{invite}', 403, false,
            fn ($t, $a) => ['DELETE', route('admin.invites.destroy', $t['invite']), []]),
        'admin report status' => $case('PATCH admin/reports/{report}', 403, false,
            fn ($t, $a) => ['PATCH', route('admin.reports.update-status', $t['report']), ['status' => 'resolved']]),
        'admin download' => $case('GET downloads/{file}', 403, false,
            fn ($t, $a) => ['GET', route('downloads.show', 'extension'), []]),
        'admin word update' => $case('PATCH words/{word}', 403, false,
            fn ($t, $a) => ['PATCH', route('words.update', $t['word']), ['word' => 'hacked', 'meaning_hu' => 'HACKED']]),
        'admin word destroy' => $case('DELETE words/{word}', 403, false,
            fn ($t, $a) => ['DELETE', route('words.destroy', $t['word']), []]),
        'admin word ai fill' => $case('POST words/{word}/ai-fill', 403, false,
            fn ($t, $a) => ['POST', route('words.ai-fill', $t['word']), []]),
    ];
}

/**
 * Paramétert átvevő route-ok, amelyeknek szándékosan NINCS tulajdonos-esetük.
 *
 * @return array<string, string>
 */
function ownershipGuardExclusions(): array
{
    return [
        'POST pricing/checkout/{plan}' => 'a {plan} egy konfigurált csomag-slug, nem felhasználói erőforrás',
    ];
}

/**
 * Egységes kérés-küldés: JSON Accept (így a validációs hiba 422, nem rejtett redirect),
 * form-adatként, hogy a fájlfeltöltés is működjön.
 *
 * @param  array<string, mixed>  $payload
 */
function ownershipGuardSend(TestCase $test, string $method, string $url, array $payload): TestResponse
{
    $files = array_filter($payload, fn ($value) => $value instanceof UploadedFile);

    return $test->call($method, $url, array_diff_key($payload, $files), [], $files, ['HTTP_ACCEPT' => 'application/json']);
}

beforeEach(function () {
    // A RequirePassword mögötti route-ot (player-devices) is a tulajdonos-ellenőrzésig
    // kell engedni, különben a teszt a jelszó-megerősítésen "zöldülne".
    $this->withSession(['auth.password_confirmed_at' => time()]);
});

it('blocks another user from reaching a foreign resource', function (string $case) {
    $spec = ownershipGuardCases()[$case];

    $victim = User::factory()->create();
    $attacker = User::factory()->create();
    $victimResources = ownershipGuardFixtures($victim);
    $attackerResources = ownershipGuardFixtures($attacker);

    // Idegen számlánál a Billingo-hívásnak el sem szabad indulnia (T-3).
    $this->mock(BillingoClient::class, fn ($mock) => $mock->shouldNotReceive('downloadDocument'));

    $before = ownershipGuardSnapshot($victimResources);

    [$method, $url, $payload] = ($spec['request'])($victimResources, $attackerResources);

    ownershipGuardSend($this->actingAs($attacker), $method, $url, $payload)
        ->assertStatus($spec['attack']);

    expect(ownershipGuardSnapshot($victimResources))->toEqual($before);
})->with(fn () => array_keys(ownershipGuardCases()));

it('lets the owner reach their own resource', function (string $case) {
    $spec = ownershipGuardCases()[$case];

    $owner = User::factory()->create();
    $resources = ownershipGuardFixtures($owner);

    $this->mock(BillingoClient::class, fn ($mock) => $mock->shouldReceive('downloadDocument')->andReturn('%PDF-1.4 fake'));

    [$method, $url, $payload] = ($spec['request'])($resources, $resources);

    $response = ownershipGuardSend($this->actingAs($owner), $method, $url, $payload);

    expect($response->getStatusCode())->toBeGreaterThanOrEqual(200)->toBeLessThan(400);
    $response->assertSessionHasNoErrors();
})->with(fn () => array_keys(array_filter(ownershipGuardCases(), fn (array $spec) => $spec['owner'])));

it('removes the owners own player device token', function () {
    $owner = User::factory()->create();
    $resources = ownershipGuardFixtures($owner);

    ownershipGuardSend($this->actingAs($owner), 'DELETE', route('security.player-devices.destroy', ['tokenId' => $resources['tokenId']]), [])
        ->assertRedirect();

    expect($owner->tokens()->whereKey($resources['tokenId'])->exists())->toBeFalse();
});

it('covers every application route that takes a parameter', function () {
    $covered = collect(ownershipGuardCases())->pluck('route')->unique();
    $excluded = collect(ownershipGuardExclusions())->keys();

    $parameterisedRoutes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => $route->parameterNames() !== [])
        ->filter(fn ($route) => str_starts_with($route->getActionName(), 'App\\') || $route->getActionName() === 'Closure')
        ->map(fn ($route) => collect($route->methods())->reject(fn ($method) => $method === 'HEAD')->first().' '.$route->uri())
        ->unique()
        ->values();

    $unguarded = $parameterisedRoutes->diff($covered)->diff($excluded)->values()->all();
    $stale = $covered->merge($excluded)->diff($parameterisedRoutes)->values()->all();

    expect($unguarded)->toBe([], 'Új, paramétert átvevő route tulajdonos-őrző eset nélkül — vedd fel az ownershipGuardCases()-be: '.implode(', ', $unguarded))
        ->and($stale)->toBe([], 'Megszűnt route maradt az őrző listában: '.implode(', ', $stale));
});
