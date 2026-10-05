<?php

use App\Services\WordPageMarkers;

/**
 * @param  list<int>  $markedIds
 * @param  list<int>  $orderedIds
 */
function markers(array $markedIds, array $orderedIds, int $perPage = 50): WordPageMarkers
{
    return new WordPageMarkers(collect($markedIds), collect($orderedIds), $perPage);
}

test('no marked words yields no marked and no completed pages', function () {
    $markers = markers([], range(1, 120));

    expect($markers->markedPages())->toBe([]);
    expect($markers->completedPages())->toBe([]);
});

test('marked pages report every page holding at least one marked word', function () {
    $markers = markers([2, 61, 101], range(1, 120));

    expect($markers->markedPages())->toBe([1, 2, 3]);
});

test('several marked words on one page collapse into a single page number', function () {
    $markers = markers([1, 2, 3, 4], range(1, 120));

    expect($markers->markedPages())->toBe([1]);
});

test('a fully marked page is reported as completed', function () {
    $markers = markers([...range(1, 50), 60, 70], range(1, 120));

    expect($markers->markedPages())->toBe([1, 2]);
    expect($markers->completedPages())->toBe([1]);
});

test('a partially marked page is never completed', function () {
    $markers = markers(range(1, 49), range(1, 120));

    expect($markers->markedPages())->toBe([1]);
    expect($markers->completedPages())->toBe([]);
});

test('the trailing short page counts as completed when all of it is marked', function () {
    $markers = markers(range(101, 120), range(1, 120));

    expect($markers->completedPages())->toBe([3]);
});

test('marked ids outside the filtered list are ignored', function () {
    $markers = markers([2197], range(1, 120));

    expect($markers->markedPages())->toBe([]);
    expect($markers->completedPages())->toBe([]);
});

test('page numbers follow list position, not word id', function () {
    $ordered = [...range(100, 149), 7];
    $markers = markers([7], $ordered);

    expect($markers->markedPages())->toBe([2]);
});

test('page size changes which page a word falls on', function () {
    $markers = markers([61], range(1, 120), perPage: 20);

    expect($markers->markedPages())->toBe([4]);
});

test('an empty filtered list yields nothing even with marked words', function () {
    $markers = markers([1, 2, 3], []);

    expect($markers->markedPages())->toBe([]);
    expect($markers->completedPages())->toBe([]);
});
