<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadController extends Controller
{
    /**
     * Filename per public slug, kept off the private disk's own naming so the
     * URL cannot be used to probe arbitrary paths on the disk.
     *
     * @var array<string, string>
     */
    private const FILES = [
        'extension' => 'topwords-extension.zip',
        'player-mac' => 'topwords-player-mac.dmg',
        'player-win' => 'topwords-player-win.exe',
    ];

    public function show(string $file): StreamedResponse
    {
        abort_unless(array_key_exists($file, self::FILES), 404);

        $filename = self::FILES[$file];

        abort_unless(Storage::disk('local')->exists("downloads/{$filename}"), 404);

        return Storage::disk('local')->download("downloads/{$filename}", $filename);
    }
}
