<?php

use App\Services\TransientCaptionException;
use App\Services\YouTubeCaptionService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->service = new YouTubeCaptionService;
    $this->videoId = 'abcdefghijk';
    $this->missKey = "youtube:transcript-miss:{$this->videoId}";
});

test('a definitive no-captions result throws RuntimeException and is negatively cached', function () {
    Http::fake([
        'https://www.youtube.com/youtubei/v1/player*' => Http::response(['captions' => []]),
        'https://www.youtube.com/api/timedtext*' => Http::response('', 200),
        'https://www.youtube.com/watch*' => Http::response(
            '<html><head><title>No Caps - YouTube</title></head><body>"INNERTUBE_API_KEY":"AIzaTest123"</body></html>'
        ),
    ]);

    expect(fn () => $this->service->fetchTranscript($this->videoId))
        ->toThrow(RuntimeException::class);

    expect(Cache::has($this->missKey))->toBeTrue();
});

test('a transient YouTube error is not negatively cached and stays retryable', function () {
    Http::fake([
        'https://www.youtube.com/*' => Http::response('rate limited', 429),
    ]);

    expect(fn () => $this->service->fetchTranscript($this->videoId))
        ->toThrow(TransientCaptionException::class);

    expect(Cache::has($this->missKey))->toBeFalse();
});

test('a transient connection error is not negatively cached', function () {
    Http::fake(function () {
        throw new ConnectionException('timeout');
    });

    expect(fn () => $this->service->fetchTranscript($this->videoId))
        ->toThrow(TransientCaptionException::class);

    expect(Cache::has($this->missKey))->toBeFalse();
});
