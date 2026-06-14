<?php

use App\Models\Folder;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

it('creates a folder', function () {
    $this->post(route('folders.store'), ['name' => 'Utazás'])
        ->assertRedirect();

    expect($this->user->folders()->where('name', 'Utazás')->exists())->toBeTrue();
});

it('does not create a folder without a name', function () {
    $this->post(route('folders.store'), ['name' => ''])
        ->assertSessionHasErrors('name');
});

it('does not create a folder with a name longer than 50 characters', function () {
    $this->post(route('folders.store'), ['name' => str_repeat('a', 51)])
        ->assertSessionHasErrors('name');
});

it('updates a folder name', function () {
    $folder = Folder::factory()->for($this->user)->create(['name' => 'Régi']);

    $this->patch(route('folders.update', $folder), ['name' => 'Új'])
        ->assertRedirect();

    expect($folder->fresh()->name)->toBe('Új');
});

it('cannot update another user\'s folder', function () {
    $folder = Folder::factory()->create();

    $this->patch(route('folders.update', $folder), ['name' => 'Hack'])
        ->assertForbidden();
});

it('deletes a folder', function () {
    $folder = Folder::factory()->for($this->user)->create();

    $this->delete(route('folders.destroy', $folder))
        ->assertRedirect();

    expect(Folder::find($folder->id))->toBeNull();
});

it('cannot delete another user\'s folder', function () {
    $folder = Folder::factory()->create();

    $this->delete(route('folders.destroy', $folder))
        ->assertForbidden();
});
