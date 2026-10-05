<?php

use App\Models\User;
use App\Models\UserBook;
use Illuminate\Http\UploadedFile;

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
    $user = User::factory()->create();

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

function makeEpubPaddedTo(int $padBytes): string
{
    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose.</p>', 5);
    $path = makeEpub($prose);

    $zip = new ZipArchive;
    $zip->open($path);
    $zip->addFromString('assets/cover.bin', random_bytes($padBytes));
    $zip->close();

    return $path;
}

test('a 3 MB-nál nagyobb EPUB-ot a validáció utasítja el, kinyerés előtt', function () {
    $user = User::factory()->create();

    $path = makeEpubPaddedTo(4 * 1024 * 1024);
    expect(filesize($path))->toBeGreaterThan(3 * 1024 * 1024);

    $upload = new UploadedFile($path, 'huge.epub', 'application/epub+zip', null, true);

    $this->actingAs($user)
        ->postJson(route('text-analysis.books.store'), ['file' => $upload])
        ->assertStatus(422)
        ->assertJsonValidationErrors('file');

    expect(UserBook::where('user_id', $user->id)->count())->toBe(0);

    @unlink($path);
});

test('a 3 MB-os keret alatti EPUB átmegy', function () {
    $user = User::factory()->create();

    $path = makeEpubPaddedTo(2 * 1024 * 1024);
    expect(filesize($path))->toBeLessThan(3 * 1024 * 1024);

    $upload = new UploadedFile($path, 'ok.epub', 'application/epub+zip', null, true);

    $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload])
        ->assertOk();

    expect(UserBook::where('user_id', $user->id)->count())->toBe(1);

    @unlink($path);
});

test('a book whose extracted text exceeds the size cap is rejected with 422', function () {
    $user = User::factory()->create();

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

    $huge = '<p>'.str_repeat('word ', 1_200_000).'</p>';
    $path = makeEpub($huge);

    $upload = new UploadedFile($path, 'bomb.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertStatus(422);
    expect(UserBook::where('user_id', $user->id)->count())->toBe(0);

    @unlink($path);
});

test('a PDF feltöltése el van utasítva (a PDF-támogatás ki lett vezetve)', function () {
    $user = User::factory()->create();

    $path = tempnam(sys_get_temp_dir(), 'pdf').'.pdf';
    file_put_contents($path, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

    $upload = new UploadedFile($path, 'book.pdf', 'application/pdf', null, true);

    $this->actingAs($user)
        ->postJson(route('text-analysis.books.store'), ['file' => $upload])
        ->assertStatus(422)
        ->assertJsonValidationErrors('file');

    expect(UserBook::where('user_id', $user->id)->count())->toBe(0);

    @unlink($path);
});

test('a .epub-ra átnevezett PDF sem csúszik át (kiterjesztés-hamisítás)', function () {
    $user = User::factory()->create();

    $path = tempnam(sys_get_temp_dir(), 'fake').'.epub';
    file_put_contents($path, "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

    $upload = new UploadedFile($path, 'fake.epub', 'application/epub+zip', null, true);

    $this->actingAs($user)
        ->postJson(route('text-analysis.books.store'), ['file' => $upload])
        ->assertStatus(422);

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

test('a tárolt szöveg megtartja a bekezdés-határokat', function () {
    $user = User::factory()->create();

    $path = makeEpub(
        '<p>This is the first paragraph of the book and it is long enough to survive.</p>'.
        '<p>This is the second paragraph of the book and it is also long enough.</p>'.
        '<p>Blurb line one is here<br/>Blurb line two is here</p>'
    );

    $upload = new UploadedFile($path, 'paragraphs.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)
        ->post(route('text-analysis.books.store'), ['file' => $upload]);

    $response->assertOk();

    $stored = gzdecode(UserBook::where('user_id', $user->id)->sole()->compressed_text);

    expect($stored)->toBe(
        "This is the first paragraph of the book and it is long enough to survive.\n".
        "This is the second paragraph of the book and it is also long enough.\n".
        "Blurb line one is here\n".
        'Blurb line two is here'
    );

    expect($response->json('text'))->toContain("survive.\nThis is the second");

    @unlink($path);
});

test('a feltöltés válaszának első lapja is szóhatáron végződik', function () {
    $user = User::factory()->create();

    $prose = str_repeat('<p>This is a sufficiently long sentence of readable prose about page boundary handling.</p>', 200);
    $path = makeEpub($prose);
    $upload = new UploadedFile($path, 'book.epub', 'application/epub+zip', null, true);

    $response = $this->actingAs($user)->post(route('text-analysis.books.store'), ['file' => $upload]);
    @unlink($path);

    $response->assertOk();
    $book = UserBook::where('user_id', $user->id)->sole();

    $firstPage = $response->json('text');
    $seam = mb_substr($firstPage, -1).mb_substr($book->getPage(2), 0, 1);

    expect($book->total_pages)->toBeGreaterThan(1)
        ->and($firstPage)->toBe($book->getPage(1))
        ->and($seam)->toMatch('/\s/');
});
