import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
import decks from './decks'
/**
* @see \App\Http\Controllers\FlashcardFolderController::store
* @see app/Http/Controllers/FlashcardFolderController.php:12
* @route '/flashcards/folders'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/flashcards/folders',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardFolderController::store
* @see app/Http/Controllers/FlashcardFolderController.php:12
* @route '/flashcards/folders'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardFolderController::store
* @see app/Http/Controllers/FlashcardFolderController.php:12
* @route '/flashcards/folders'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::store
* @see app/Http/Controllers/FlashcardFolderController.php:12
* @route '/flashcards/folders'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::store
* @see app/Http/Controllers/FlashcardFolderController.php:12
* @route '/flashcards/folders'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\FlashcardFolderController::update
* @see app/Http/Controllers/FlashcardFolderController.php:21
* @route '/flashcards/folders/{flashcardFolder}'
*/
export const update = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/flashcards/folders/{flashcardFolder}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FlashcardFolderController::update
* @see app/Http/Controllers/FlashcardFolderController.php:21
* @route '/flashcards/folders/{flashcardFolder}'
*/
update.url = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { flashcardFolder: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { flashcardFolder: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            flashcardFolder: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        flashcardFolder: typeof args.flashcardFolder === 'object'
        ? args.flashcardFolder.id
        : args.flashcardFolder,
    }

    return update.definition.url
            .replace('{flashcardFolder}', parsedArgs.flashcardFolder.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardFolderController::update
* @see app/Http/Controllers/FlashcardFolderController.php:21
* @route '/flashcards/folders/{flashcardFolder}'
*/
update.patch = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::update
* @see app/Http/Controllers/FlashcardFolderController.php:21
* @route '/flashcards/folders/{flashcardFolder}'
*/
const updateForm = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::update
* @see app/Http/Controllers/FlashcardFolderController.php:21
* @route '/flashcards/folders/{flashcardFolder}'
*/
updateForm.patch = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\FlashcardFolderController::destroy
* @see app/Http/Controllers/FlashcardFolderController.php:32
* @route '/flashcards/folders/{flashcardFolder}'
*/
export const destroy = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/flashcards/folders/{flashcardFolder}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FlashcardFolderController::destroy
* @see app/Http/Controllers/FlashcardFolderController.php:32
* @route '/flashcards/folders/{flashcardFolder}'
*/
destroy.url = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { flashcardFolder: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { flashcardFolder: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            flashcardFolder: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        flashcardFolder: typeof args.flashcardFolder === 'object'
        ? args.flashcardFolder.id
        : args.flashcardFolder,
    }

    return destroy.definition.url
            .replace('{flashcardFolder}', parsedArgs.flashcardFolder.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardFolderController::destroy
* @see app/Http/Controllers/FlashcardFolderController.php:32
* @route '/flashcards/folders/{flashcardFolder}'
*/
destroy.delete = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::destroy
* @see app/Http/Controllers/FlashcardFolderController.php:32
* @route '/flashcards/folders/{flashcardFolder}'
*/
const destroyForm = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardFolderController::destroy
* @see app/Http/Controllers/FlashcardFolderController.php:32
* @route '/flashcards/folders/{flashcardFolder}'
*/
destroyForm.delete = (args: { flashcardFolder: number | { id: number } } | [flashcardFolder: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const folders = {
    store: Object.assign(store, store),
    update: Object.assign(update, update),
    destroy: Object.assign(destroy, destroy),
    decks: Object.assign(decks, decks),
}

export default folders