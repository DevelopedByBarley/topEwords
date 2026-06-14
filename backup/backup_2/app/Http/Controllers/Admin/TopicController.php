<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TopicRequest;
use App\Models\Topic;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Illuminate\View\View;

class TopicController extends Controller
{
    public function index(): View
    {
        $topics = Topic::orderBy('name->hu')->paginate(20);

        return view('admin.topics.index', compact('topics'));
    }

    public function create(): View
    {
        return view('admin.topics.create');
    }

    public function store(TopicRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = Str::slug($data['name']['en'] ?: $data['name']['hu']);

        Topic::create($data);

        return redirect()->route('admin.topics.index')
            ->with('success', 'Téma sikeresen létrehozva.');
    }

    public function edit(Topic $topic): View
    {
        return view('admin.topics.edit', compact('topic'));
    }

    public function update(TopicRequest $request, Topic $topic): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = Str::slug($data['name']['en'] ?: $data['name']['hu']);

        $topic->update($data);

        return redirect()->route('admin.topics.index')
            ->with('success', 'Téma sikeresen módosítva.');
    }

    public function destroy(Topic $topic): RedirectResponse
    {
        $topic->delete();

        return redirect()->route('admin.topics.index')
            ->with('success', 'Téma sikeresen törölve.');
    }
}
