import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/flashcards',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::index
* @see app/Http/Controllers/FlashcardDeckController.php:20
* @route '/flashcards'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::store
* @see app/Http/Controllers/FlashcardDeckController.php:79
* @route '/flashcards'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/flashcards',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::store
* @see app/Http/Controllers/FlashcardDeckController.php:79
* @route '/flashcards'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::store
* @see app/Http/Controllers/FlashcardDeckController.php:79
* @route '/flashcards'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::store
* @see app/Http/Controllers/FlashcardDeckController.php:79
* @route '/flashcards'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::store
* @see app/Http/Controllers/FlashcardDeckController.php:79
* @route '/flashcards'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
export const show = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/flashcards/{deck}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
show.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return show.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
show.get = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
show.head = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
const showForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
showForm.get = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::show
* @see app/Http/Controllers/FlashcardDeckController.php:107
* @route '/flashcards/{deck}'
*/
showForm.head = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

show.form = showForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::update
* @see app/Http/Controllers/FlashcardDeckController.php:195
* @route '/flashcards/{deck}'
*/
export const update = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/flashcards/{deck}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::update
* @see app/Http/Controllers/FlashcardDeckController.php:195
* @route '/flashcards/{deck}'
*/
update.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return update.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::update
* @see app/Http/Controllers/FlashcardDeckController.php:195
* @route '/flashcards/{deck}'
*/
update.patch = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::update
* @see app/Http/Controllers/FlashcardDeckController.php:195
* @route '/flashcards/{deck}'
*/
const updateForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::update
* @see app/Http/Controllers/FlashcardDeckController.php:195
* @route '/flashcards/{deck}'
*/
updateForm.patch = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroy
* @see app/Http/Controllers/FlashcardDeckController.php:225
* @route '/flashcards/{deck}'
*/
export const destroy = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/flashcards/{deck}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroy
* @see app/Http/Controllers/FlashcardDeckController.php:225
* @route '/flashcards/{deck}'
*/
destroy.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return destroy.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroy
* @see app/Http/Controllers/FlashcardDeckController.php:225
* @route '/flashcards/{deck}'
*/
destroy.delete = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroy
* @see app/Http/Controllers/FlashcardDeckController.php:225
* @route '/flashcards/{deck}'
*/
const destroyForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroy
* @see app/Http/Controllers/FlashcardDeckController.php:225
* @route '/flashcards/{deck}'
*/
destroyForm.delete = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::updateSettings
* @see app/Http/Controllers/FlashcardDeckController.php:204
* @route '/flashcards/{deck}/settings'
*/
export const updateSettings = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: updateSettings.url(args, options),
    method: 'put',
})

updateSettings.definition = {
    methods: ["put"],
    url: '/flashcards/{deck}/settings',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::updateSettings
* @see app/Http/Controllers/FlashcardDeckController.php:204
* @route '/flashcards/{deck}/settings'
*/
updateSettings.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return updateSettings.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::updateSettings
* @see app/Http/Controllers/FlashcardDeckController.php:204
* @route '/flashcards/{deck}/settings'
*/
updateSettings.put = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: updateSettings.url(args, options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::updateSettings
* @see app/Http/Controllers/FlashcardDeckController.php:204
* @route '/flashcards/{deck}/settings'
*/
const updateSettingsForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: updateSettings.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::updateSettings
* @see app/Http/Controllers/FlashcardDeckController.php:204
* @route '/flashcards/{deck}/settings'
*/
updateSettingsForm.put = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: updateSettings.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

updateSettings.form = updateSettingsForm

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroySettings
* @see app/Http/Controllers/FlashcardDeckController.php:216
* @route '/flashcards/{deck}/settings'
*/
export const destroySettings = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroySettings.url(args, options),
    method: 'delete',
})

destroySettings.definition = {
    methods: ["delete"],
    url: '/flashcards/{deck}/settings',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroySettings
* @see app/Http/Controllers/FlashcardDeckController.php:216
* @route '/flashcards/{deck}/settings'
*/
destroySettings.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return destroySettings.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroySettings
* @see app/Http/Controllers/FlashcardDeckController.php:216
* @route '/flashcards/{deck}/settings'
*/
destroySettings.delete = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroySettings.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroySettings
* @see app/Http/Controllers/FlashcardDeckController.php:216
* @route '/flashcards/{deck}/settings'
*/
const destroySettingsForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroySettings.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardDeckController::destroySettings
* @see app/Http/Controllers/FlashcardDeckController.php:216
* @route '/flashcards/{deck}/settings'
*/
destroySettingsForm.delete = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroySettings.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroySettings.form = destroySettingsForm

const FlashcardDeckController = { index, store, show, update, destroy, updateSettings, destroySettings }

export default FlashcardDeckController