<?php

namespace App\Http\Controllers;

use App\Models\Program;
use Illuminate\View\View;

class ProgramController extends Controller
{
    public function show(string $slug): View
    {
        $model = Program::with(['topics', 'images'])
            ->where('slug', $slug)
            ->where('active', true)
            ->firstOrFail();

        $model->increment('views');

        $gallery = $model->images->map(fn ($img) => $img->url())->values()->toArray();

        if (empty($gallery)) {
            $gallery = ['https://picsum.photos/seed/'.$slug.'/1200/800'];
        }

        $program = [
            'slug' => $slug,
            'name' => $model->getTranslation('name'),
            'topic' => $model->topics->map->getTranslation()->filter()->implode(', '),
            'tagline' => '',
            'price' => number_format($model->price_adult ?? 0, 0, ',', ' '),
            'price_child' => $model->price_child !== null ? number_format($model->price_child, 0, ',', ' ') : null,
            'child_age_min' => $model->child_age_min,
            'child_age_max' => $model->child_age_max,
            'duration' => $model->getTranslation('duration'),
            'group_size' => $model->group_size,
            'available_days' => $model->available_days ?? [],
            'youtube_embed_url' => $model->youtubeEmbedUrl(),
            'gallery' => $gallery,
            'description' => $model->getTranslation('description'),
        ];

        return view('programs.show', compact('program'));
    }
}
