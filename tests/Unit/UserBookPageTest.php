<?php

use App\Models\UserBook;

/**
 * A könyv-lapozás határai.
 *
 * A lelet: a lap nyers karakter-offseten vágódott, ezért a határon álló szó
 * kettéhasadt — a „have" `h`-ként zárta az egyik lapot és `ave`-ként nyitotta a
 * következőt. Az olvasónak hibás szó, a szóelemzőnek két hibás token.
 */

/** `$size` karakter prózát ad, `$word` a `$at`. karakterpozíción kezdődik. */
function proseWithWordAt(string $word, int $at, int $size): string
{
    $filler = str_repeat('lorem ipsum ', (int) ceil($size / 12));
    $text = mb_substr($filler, 0, $size);

    return mb_substr($text, 0, $at).$word.' '.mb_substr($text, $at + mb_strlen($word) + 1);
}

test('a lap határa nem vág szó közepén', function () {
    // A „have" a 4998. pozíción kezdődik, tehát átnyúlik az 5000-es nominális
    // határon: nyers vágással az első lap `...ha`-ra végződött.
    $text = proseWithWordAt('have', UserBook::PAGE_SIZE - 2, 12_000);

    $first = UserBook::slicePage($text, 1);
    $second = UserBook::slicePage($text, 2);

    expect($first)->not->toEndWith('ha')
        ->and(trim($first))->toEndWith('lorem')
        ->and($second)->toStartWith('have ');
});

test('a lapok hézag és átfedés nélkül fedik a teljes szöveget', function () {
    $text = proseWithWordAt('have', UserBook::PAGE_SIZE - 2, 12_000);
    $totalPages = (int) ceil(mb_strlen($text) / UserBook::PAGE_SIZE);

    $pages = array_map(fn (int $page): string => UserBook::slicePage($text, $page), range(1, $totalPages));

    // A szóhatárra igazítás se nem veszít el, se nem duplázik szöveget, és a
    // `total_pages` (a nominális offsetekből számolt lapszám) érvényes marad.
    expect(implode('', $pages))->toBe($text)
        ->and($totalPages)->toBe(3)
        ->and(UserBook::slicePage($text, 4))->toBe('');
});

test('a szóköz nélküli blokk a nominális offseten vágódik', function () {
    // Szóhatár nélkül a keresés különben végigfutna az egész könyvön.
    $text = str_repeat('a', 12_000);

    expect(mb_strlen(UserBook::slicePage($text, 1)))->toBe(UserBook::PAGE_SIZE)
        ->and(UserBook::slicePage($text, 1).UserBook::slicePage($text, 2).UserBook::slicePage($text, 3))->toBe($text);
});

test('a többbájtos szöveg határa is karakteren áll, nem bájton', function () {
    // Bájt-alapú vágásnál a határon álló ékezetes karakter fele-fele arányban
    // két lapra esett volna, és a kimenet érvénytelen UTF-8 lett.
    $text = str_repeat('árvíztűrő tükörfúrógép ', 600);

    $pages = [UserBook::slicePage($text, 1), UserBook::slicePage($text, 2), UserBook::slicePage($text, 3)];

    foreach ($pages as $page) {
        expect(mb_check_encoding($page, 'UTF-8'))->toBeTrue();
    }

    expect(implode('', $pages))->toBe($text);
});

test('az utolsó lap a szöveg végéig tart', function () {
    $text = proseWithWordAt('have', UserBook::PAGE_SIZE - 2, 11_000);

    expect(UserBook::slicePage($text, 3))->toEndWith(mb_substr($text, -20));
});
