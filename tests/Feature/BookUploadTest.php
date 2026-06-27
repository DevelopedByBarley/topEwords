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
