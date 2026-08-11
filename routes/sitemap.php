<?php

use Illuminate\Support\Facades\Route;

Route::get('/sitemap.xml', function () {
    return response()->view('sitemap')->header('Content-Type', 'application/xml');
})->name('sitemap');
