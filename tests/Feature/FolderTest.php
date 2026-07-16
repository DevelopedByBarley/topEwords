<?php

use App\Models\Folder;
use App\Models\User;

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

it('does not create two folders with the same name for the same user', function () {
    Folder::factory()->for($this->user)->create(['name' => 'Utazás']);

    $this->post(route('folders.store'), ['name' => 'Utazás'])
        ->assertSessionHasErrors('name');

    expect($this->user->folders()->where('name', 'Utazás')->count())->toBe(1);
});

it('allows two users to have folders with the same name', function () {
    Folder::factory()->create(['name' => 'Utazás']);

    $this->post(route('folders.store'), ['name' => 'Utazás'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($this->user->folders()->where('name', 'Utazás')->exists())->toBeTrue();
});

it('does not create a folder beyond the per-user maximum', function () {
    Folder::factory()->for($this->user)->count(100)->sequence(fn ($sequence) => ['name' => 'Mappa '.$sequence->index])->create();

    $this->post(route('folders.store'), ['name' => 'Egy mappa túl sok'])
        ->assertSessionHasErrors('name');

    expect($this->user->folders()->count())->toBe(100);
});

it('does not report a duplicate-name error as a limit error', function () {
    Folder::factory()->for($this->user)->create(['name' => 'Létező']);

    $this->post(route('folders.store'), ['name' => 'Létező'])
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
