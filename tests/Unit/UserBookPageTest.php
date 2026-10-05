<?php

use App\Models\UserBook;

function proseWithWordAt(string $word, int $at, int $size): string
{
    $filler = str_repeat('lorem ipsum ', (int) ceil($size / 12));
    $text = mb_substr($filler, 0, $size);

    return mb_substr($text, 0, $at).$word.' '.mb_substr($text, $at + mb_strlen($word) + 1);
}

test('a lap határa nem vág szó közepén', function () {
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

    expect(implode('', $pages))->toBe($text)
        ->and($totalPages)->toBe(3)
        ->and(UserBook::slicePage($text, 4))->toBe('');
});

test('a szóköz nélküli blokk a nominális offseten vágódik', function () {
    $text = str_repeat('a', 12_000);

    expect(mb_strlen(UserBook::slicePage($text, 1)))->toBe(UserBook::PAGE_SIZE)
        ->and(UserBook::slicePage($text, 1).UserBook::slicePage($text, 2).UserBook::slicePage($text, 3))->toBe($text);
});

test('a többbájtos szöveg határa is karakteren áll, nem bájton', function () {
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
