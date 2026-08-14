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
    // A 2. hely az 1. lapra, a 61. a 2. lapra, a 101. a 3. lapra esik.
    $markers = markers([2, 61, 101], range(1, 120));

    expect($markers->markedPages())->toBe([1, 2, 3]);
});

test('several marked words on one page collapse into a single page number', function () {
    $markers = markers([1, 2, 3, 4], range(1, 120));

    expect($markers->markedPages())->toBe([1]);
});

test('a fully marked page is reported as completed', function () {
    // Az első 50 szó mind megjelölt, a 60. és 70. csak részlegesen jelöli a 2. lapot.
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
    // A 3. lapon csak 20 szó van; ha mind megjelölt, elkészültnek számít.
    $markers = markers(range(101, 120), range(1, 120));

    expect($markers->completedPages())->toBe([3]);
});

test('marked ids outside the filtered list are ignored', function () {
    // A 2197 nincs a szűrt sorrendben, ezért egyetlen lapot sem jelöl meg.
    $markers = markers([2197], range(1, 120));

    expect($markers->markedPages())->toBe([]);
    expect($markers->completedPages())->toBe([]);
});

test('page numbers follow list position, not word id', function () {
    // A sorrend rank szerinti, nem azonosító szerinti: a 7-es szó a 2. lapon áll.
    $ordered = [...range(100, 149), 7];
    $markers = markers([7], $ordered);

    expect($markers->markedPages())->toBe([2]);
});

test('page size changes which page a word falls on', function () {
    $markers = markers([61], range(1, 120), perPage: 20);

    // A 61. hely 20-as lapméretnél a 4. lapra esik.
    expect($markers->markedPages())->toBe([4]);
});

test('an empty filtered list yields nothing even with marked words', function () {
    $markers = markers([1, 2, 3], []);

    expect($markers->markedPages())->toBe([]);
    expect($markers->completedPages())->toBe([]);
});
