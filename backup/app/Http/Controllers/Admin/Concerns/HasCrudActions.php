<?php

namespace App\Http\Controllers\Admin\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

trait HasCrudActions
{
    // Definiáld a leszármazóban:
    // protected string $model = MyModel::class;
    // protected string $viewPrefix = 'admin.my-model';
    // protected string $routePrefix = 'admin.my-model';
    // protected array $validationRules = [];

    public function index(): View
    {
        $items = $this->model::paginate(20);

        return view("{$this->viewPrefix}.index", compact('items'));
    }

    public function create(): View
    {
        return view("{$this->viewPrefix}.create");
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate($this->validationRules);
        $this->model::create($data);

        return redirect()->route("{$this->routePrefix}.index")
            ->with('success', 'Sikeresen létrehozva.');
    }

    public function edit(Model $model): View
    {
        return view("{$this->viewPrefix}.edit", compact('model'));
    }

    public function update(Request $request, Model $model): RedirectResponse
    {
        $data = $request->validate($this->validationRules);
        $model->update($data);

        return redirect()->route("{$this->routePrefix}.index")
            ->with('success', 'Sikeresen módosítva.');
    }

    public function destroy(Model $model): RedirectResponse
    {
        $model->delete();

        return redirect()->route("{$this->routePrefix}.index")
            ->with('success', 'Sikeresen törölve.');
    }
}
