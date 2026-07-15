<?php

use App\Models\User;
use App\Models\UserBook;
use Illuminate\Http\UploadedFile;

/**
 * Build a minimal EPUB (zip) on disk with one chapter whose body is $chapterHtml,
 * and return its path. The caller is responsible for the file's lifetime.
 */
function makeEpub(string $chapterHtml): string
{
    $path = tempnam(sys_get_temp_dir(), 'epub').'.epub';

    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);

    $zip->addFromString('META-INF/container.xml', <<<'XML'
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
        </container>
        XML);

    $zip->addFromString('content.opf', <<<'XML'
        <?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest>
          <spine><itemref idref="ch1"/></spine>
        </package>
        XML);

    $zip->addFromString('chapter1.xhtml', "<html><body>{$chapterHtml}</body></html>");
    $zip->close();

    return $path;
}

test('a valid EPUB is uploaded and its text extracted', function () {
    $user = User::factory()->create();

    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose.</p>', 5);
    $path = makeEpub($prose);

    $upload = new UploadedFile($path, 'book.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertOk();
    expect(UserBook::where('user_id', $user->id)->count())->toBe(1);

    @unlink($path);
});

test('an EPUB whose HTML files lack a .xhtml extension is extracted via manifest media-type', function () {
    $user = User::factory()->create();

    // Calibre splits name chapter files like ".html_split_000" with no standard
    // extension, declaring them as application/xhtml+xml in the manifest. The
    // extractor must trust the media-type, not the filename extension.
    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose.</p>', 5);

    $path = tempnam(sys_get_temp_dir(), 'epub').'.epub';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('META-INF/container.xml', <<<'XML'
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
        </container>
        XML);
    $zip->addFromString('content.opf', <<<'XML'
        <?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="2.0">
          <manifest><item id="ch1" href=".html_split_000" media-type="application/xhtml+xml"/></manifest>
          <spine><itemref idref="ch1"/></spine>
        </package>
        XML);
    $zip->addFromString('.html_split_000', "<html><body>{$prose}</body></html>");
    $zip->close();

    $upload = new UploadedFile($path, 'split.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertOk();
    expect(UserBook::where('user_id', $user->id)->count())->toBe(1);

    @unlink($path);
});

test('repeated spine idrefs are extracted only once (repeated-decompression guard)', function () {
    $user = User::factory()->create();

    // Egy preparált OPF ugyanarra a fejezetre mutató ismételt idref-ekkel nem
    // dolgoztathatja fel többször ugyanazt a bejegyzést (SEC_AUDIT #R11).
    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose.</p>', 4)
        .'<p>The zebraunicorn paradox appears exactly once in this chapter.</p>';

    $path = tempnam(sys_get_temp_dir(), 'epub').'.epub';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('META-INF/container.xml', <<<'XML'
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
        </container>
        XML);
    $repeatedSpine = str_repeat('<itemref idref="ch1"/>', 50);
    $zip->addFromString('content.opf', <<<XML
        <?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/></manifest>
          <spine>{$repeatedSpine}</spine>
        </package>
        XML);
    $zip->addFromString('chapter1.xhtml', "<html><body>{$prose}</body></html>");
    $zip->close();

    $upload = new UploadedFile($path, 'repeated.epub', 'application/epub+zip', null, true);

    $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload])
        ->assertOk();

    $book = UserBook::where('user_id', $user->id)->firstOrFail();
    expect(substr_count(gzdecode($book->compressed_text), 'zebraunicorn'))->toBe(1);

    @unlink($path);
});

test('the per-plan book count limit blocks further uploads', function () {
    $user = User::factory()->create(); // free csomag: 1 könyv

    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose.</p>', 5);
    $path = makeEpub($prose);

    $first = new UploadedFile($path, 'first.epub', 'application/epub+zip', null, true);
    $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $first])
        ->assertOk();

    $second = new UploadedFile($path, 'second.epub', 'application/epub+zip', null, true);
    $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $second])
        ->assertForbidden();

    expect(UserBook::where('user_id', $user->id)->count())->toBe(1);

    @unlink($path);
});

test('a book whose extracted text exceeds the size cap is rejected with 422', function () {
    $user = User::factory()->create();

    // 3 fejezet, egyenként ~4,2 MB próza: a per-entry (5 MB) és az össz-HTML
    // (40 MB) sapkák alatt marad, de a kinyert szöveg (~12,6 MB) átlépi a
    // MAX_BOOK_TEXT_BYTES (10 MB) sapkát — a MEDIUMBLOB-túlcsordulás (500-as)
    // helyett érthető 422-t kell kapnia.
    $chapter = '<p>'.str_repeat('This is a sufficiently long sentence of readable prose. ', 75_000).'</p>';

    $path = tempnam(sys_get_temp_dir(), 'epub').'.epub';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('META-INF/container.xml', <<<'XML'
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles>
        </container>
        XML);
    $zip->addFromString('content.opf', <<<'XML'
        <?xml version="1.0"?>
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <manifest>
            <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
            <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
            <item id="ch3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine><itemref idref="ch1"/><itemref idref="ch2"/><itemref idref="ch3"/></spine>
        </package>
        XML);
    foreach ([1, 2, 3] as $i) {
        $zip->addFromString("chapter{$i}.xhtml", "<html><body>{$chapter}</body></html>");
    }
    $zip->close();

    $upload = new UploadedFile($path, 'huge.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertUnprocessable();
    $response->assertJsonPath('error', fn (string $error) => str_contains($error, 'túl nagy'));
    expect(UserBook::where('user_id', $user->id)->count())->toBe(0);

    @unlink($path);
});

test('an EPUB entry larger than the per-entry cap is skipped (zip-bomb guard)', function () {
    $user = User::factory()->create();

    // ~6 MB uncompressed chapter — over MAX_EPUB_ENTRY_BYTES (5 MB). Highly
    // compressible, mimicking a zip bomb. The guard must refuse to read it, so
    // no text is extracted and the upload is rejected rather than exhausting memory.
    $huge = '<p>'.str_repeat('word ', 1_200_000).'</p>';
    $path = makeEpub($huge);

    $upload = new UploadedFile($path, 'bomb.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertStatus(422);
    expect(UserBook::where('user_id', $user->id)->count())->toBe(0);

    @unlink($path);
});

test('getPage returns empty string for a corrupt compressed blob instead of erroring', function () {
    $user = User::factory()->create();

    $book = UserBook::create([
        'user_id' => $user->id,
        'title' => 'Corrupt',
        'file_type' => 'txt',
        'compressed_text' => 'not-actually-gzip',
        'total_pages' => 1,
        'text_size' => 0,
    ]);

    expect($book->getPage(1))->toBe('');
});
