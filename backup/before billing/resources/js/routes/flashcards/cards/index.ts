import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardCardController::store
* @see app/Http/Controllers/FlashcardCardController.php:19
* @route '/flashcards/{deck}/cards'
*/
export const store = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::store
* @see app/Http/Controllers/FlashcardCardController.php:19
* @route '/flashcards/{deck}/cards'
*/
store.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return store.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::store
* @see app/Http/Controllers/FlashcardCardController.php:19
* @route '/flashcards/{deck}/cards'
*/
store.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::store
* @see app/Http/Controllers/FlashcardCardController.php:19
* @route '/flashcards/{deck}/cards'
*/
const storeForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::store
* @see app/Http/Controllers/FlashcardCardController.php:19
* @route '/flashcards/{deck}/cards'
*/
storeForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(args, options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\FlashcardCardController::importMethod
* @see app/Http/Controllers/FlashcardCardController.php:32
* @route '/flashcards/{deck}/cards/import'
*/
export const importMethod = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importMethod.url(args, options),
    method: 'post',
})

importMethod.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/import',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::importMethod
* @see app/Http/Controllers/FlashcardCardController.php:32
* @route '/flashcards/{deck}/cards/import'
*/
importMethod.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return importMethod.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::importMethod
* @see app/Http/Controllers/FlashcardCardController.php:32
* @route '/flashcards/{deck}/cards/import'
*/
importMethod.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importMethod.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::importMethod
* @see app/Http/Controllers/FlashcardCardController.php:32
* @route '/flashcards/{deck}/cards/import'
*/
const importMethodForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importMethod.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::importMethod
* @see app/Http/Controllers/FlashcardCardController.php:32
* @route '/flashcards/{deck}/cards/import'
*/
importMethodForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importMethod.url(args, options),
    method: 'post',
})

importMethod.form = importMethodForm

/**
* @see \App\Http\Controllers\FlashcardCardController::update
* @see app/Http/Controllers/FlashcardCardController.php:75
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
export const update = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/flashcards/{deck}/cards/{flashcard}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::update
* @see app/Http/Controllers/FlashcardCardController.php:75
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
update.url = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            deck: args[0],
            flashcard: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
        flashcard: typeof args.flashcard === 'object'
        ? args.flashcard.id
        : args.flashcard,
    }

    return update.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace('{flashcard}', parsedArgs.flashcard.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::update
* @see app/Http/Controllers/FlashcardCardController.php:75
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
update.patch = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::update
* @see app/Http/Controllers/FlashcardCardController.php:75
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
const updateForm = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::update
* @see app/Http/Controllers/FlashcardCardController.php:75
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
updateForm.patch = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\FlashcardCardController::reset
* @see app/Http/Controllers/FlashcardCardController.php:85
* @route '/flashcards/{deck}/cards/{flashcard}/reset'
*/
export const reset = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reset.url(args, options),
    method: 'post',
})

reset.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/{flashcard}/reset',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::reset
* @see app/Http/Controllers/FlashcardCardController.php:85
* @route '/flashcards/{deck}/cards/{flashcard}/reset'
*/
reset.url = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            deck: args[0],
            flashcard: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
        flashcard: typeof args.flashcard === 'object'
        ? args.flashcard.id
        : args.flashcard,
    }

    return reset.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace('{flashcard}', parsedArgs.flashcard.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::reset
* @see app/Http/Controllers/FlashcardCardController.php:85
* @route '/flashcards/{deck}/cards/{flashcard}/reset'
*/
reset.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: reset.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::reset
* @see app/Http/Controllers/FlashcardCardController.php:85
* @route '/flashcards/{deck}/cards/{flashcard}/reset'
*/
const resetForm = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reset.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::reset
* @see app/Http/Controllers/FlashcardCardController.php:85
* @route '/flashcards/{deck}/cards/{flashcard}/reset'
*/
resetForm.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: reset.url(args, options),
    method: 'post',
})

reset.form = resetForm

/**
* @see \App\Http\Controllers\FlashcardCardController::move
* @see app/Http/Controllers/FlashcardCardController.php:95
* @route '/flashcards/{deck}/cards/{flashcard}/move'
*/
export const move = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: move.url(args, options),
    method: 'post',
})

move.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/{flashcard}/move',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::move
* @see app/Http/Controllers/FlashcardCardController.php:95
* @route '/flashcards/{deck}/cards/{flashcard}/move'
*/
move.url = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            deck: args[0],
            flashcard: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
        flashcard: typeof args.flashcard === 'object'
        ? args.flashcard.id
        : args.flashcard,
    }

    return move.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace('{flashcard}', parsedArgs.flashcard.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::move
* @see app/Http/Controllers/FlashcardCardController.php:95
* @route '/flashcards/{deck}/cards/{flashcard}/move'
*/
move.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: move.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::move
* @see app/Http/Controllers/FlashcardCardController.php:95
* @route '/flashcards/{deck}/cards/{flashcard}/move'
*/
const moveForm = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: move.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::move
* @see app/Http/Controllers/FlashcardCardController.php:95
* @route '/flashcards/{deck}/cards/{flashcard}/move'
*/
moveForm.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: move.url(args, options),
    method: 'post',
})

move.form = moveForm

/**
* @see \App\Http\Controllers\FlashcardCardController::duplicate
* @see app/Http/Controllers/FlashcardCardController.php:117
* @route '/flashcards/{deck}/cards/{flashcard}/duplicate'
*/
export const duplicate = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: duplicate.url(args, options),
    method: 'post',
})

duplicate.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/{flashcard}/duplicate',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::duplicate
* @see app/Http/Controllers/FlashcardCardController.php:117
* @route '/flashcards/{deck}/cards/{flashcard}/duplicate'
*/
duplicate.url = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            deck: args[0],
            flashcard: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
        flashcard: typeof args.flashcard === 'object'
        ? args.flashcard.id
        : args.flashcard,
    }

    return duplicate.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace('{flashcard}', parsedArgs.flashcard.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::duplicate
* @see app/Http/Controllers/FlashcardCardController.php:117
* @route '/flashcards/{deck}/cards/{flashcard}/duplicate'
*/
duplicate.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: duplicate.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::duplicate
* @see app/Http/Controllers/FlashcardCardController.php:117
* @route '/flashcards/{deck}/cards/{flashcard}/duplicate'
*/
const duplicateForm = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: duplicate.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::duplicate
* @see app/Http/Controllers/FlashcardCardController.php:117
* @route '/flashcards/{deck}/cards/{flashcard}/duplicate'
*/
duplicateForm.post = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: duplicate.url(args, options),
    method: 'post',
})

duplicate.form = duplicateForm

/**
* @see \App\Http\Controllers\FlashcardCardController::destroy
* @see app/Http/Controllers/FlashcardCardController.php:141
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
export const destroy = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/flashcards/{deck}/cards/{flashcard}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::destroy
* @see app/Http/Controllers/FlashcardCardController.php:141
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
destroy.url = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
            deck: args[0],
            flashcard: args[1],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
        flashcard: typeof args.flashcard === 'object'
        ? args.flashcard.id
        : args.flashcard,
    }

    return destroy.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace('{flashcard}', parsedArgs.flashcard.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::destroy
* @see app/Http/Controllers/FlashcardCardController.php:141
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
destroy.delete = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::destroy
* @see app/Http/Controllers/FlashcardCardController.php:141
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
const destroyForm = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::destroy
* @see app/Http/Controllers/FlashcardCardController.php:141
* @route '/flashcards/{deck}/cards/{flashcard}'
*/
destroyForm.delete = (args: { deck: number | { id: number }, flashcard: number | { id: number } } | [deck: number | { id: number }, flashcard: number | { id: number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
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
* @see \App\Http\Controllers\FlashcardCardController::bulkDelete
* @see app/Http/Controllers/FlashcardCardController.php:151
* @route '/flashcards/{deck}/cards/bulk-delete'
*/
export const bulkDelete = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkDelete.url(args, options),
    method: 'post',
})

bulkDelete.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/bulk-delete',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDelete
* @see app/Http/Controllers/FlashcardCardController.php:151
* @route '/flashcards/{deck}/cards/bulk-delete'
*/
bulkDelete.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return bulkDelete.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDelete
* @see app/Http/Controllers/FlashcardCardController.php:151
* @route '/flashcards/{deck}/cards/bulk-delete'
*/
bulkDelete.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkDelete.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDelete
* @see app/Http/Controllers/FlashcardCardController.php:151
* @route '/flashcards/{deck}/cards/bulk-delete'
*/
const bulkDeleteForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDelete.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDelete
* @see app/Http/Controllers/FlashcardCardController.php:151
* @route '/flashcards/{deck}/cards/bulk-delete'
*/
bulkDeleteForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDelete.url(args, options),
    method: 'post',
})

bulkDelete.form = bulkDeleteForm

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReset
* @see app/Http/Controllers/FlashcardCardController.php:165
* @route '/flashcards/{deck}/cards/bulk-reset'
*/
export const bulkReset = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkReset.url(args, options),
    method: 'post',
})

bulkReset.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/bulk-reset',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReset
* @see app/Http/Controllers/FlashcardCardController.php:165
* @route '/flashcards/{deck}/cards/bulk-reset'
*/
bulkReset.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return bulkReset.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReset
* @see app/Http/Controllers/FlashcardCardController.php:165
* @route '/flashcards/{deck}/cards/bulk-reset'
*/
bulkReset.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkReset.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReset
* @see app/Http/Controllers/FlashcardCardController.php:165
* @route '/flashcards/{deck}/cards/bulk-reset'
*/
const bulkResetForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkReset.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReset
* @see app/Http/Controllers/FlashcardCardController.php:165
* @route '/flashcards/{deck}/cards/bulk-reset'
*/
bulkResetForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkReset.url(args, options),
    method: 'post',
})

bulkReset.form = bulkResetForm

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkMove
* @see app/Http/Controllers/FlashcardCardController.php:228
* @route '/flashcards/{deck}/cards/bulk-move'
*/
export const bulkMove = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkMove.url(args, options),
    method: 'post',
})

bulkMove.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/bulk-move',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkMove
* @see app/Http/Controllers/FlashcardCardController.php:228
* @route '/flashcards/{deck}/cards/bulk-move'
*/
bulkMove.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return bulkMove.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkMove
* @see app/Http/Controllers/FlashcardCardController.php:228
* @route '/flashcards/{deck}/cards/bulk-move'
*/
bulkMove.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkMove.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkMove
* @see app/Http/Controllers/FlashcardCardController.php:228
* @route '/flashcards/{deck}/cards/bulk-move'
*/
const bulkMoveForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkMove.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkMove
* @see app/Http/Controllers/FlashcardCardController.php:228
* @route '/flashcards/{deck}/cards/bulk-move'
*/
bulkMoveForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkMove.url(args, options),
    method: 'post',
})

bulkMove.form = bulkMoveForm

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReverse
* @see app/Http/Controllers/FlashcardCardController.php:180
* @route '/flashcards/{deck}/cards/bulk-reverse'
*/
export const bulkReverse = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkReverse.url(args, options),
    method: 'post',
})

bulkReverse.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/bulk-reverse',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReverse
* @see app/Http/Controllers/FlashcardCardController.php:180
* @route '/flashcards/{deck}/cards/bulk-reverse'
*/
bulkReverse.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return bulkReverse.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReverse
* @see app/Http/Controllers/FlashcardCardController.php:180
* @route '/flashcards/{deck}/cards/bulk-reverse'
*/
bulkReverse.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkReverse.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReverse
* @see app/Http/Controllers/FlashcardCardController.php:180
* @route '/flashcards/{deck}/cards/bulk-reverse'
*/
const bulkReverseForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkReverse.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkReverse
* @see app/Http/Controllers/FlashcardCardController.php:180
* @route '/flashcards/{deck}/cards/bulk-reverse'
*/
bulkReverseForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkReverse.url(args, options),
    method: 'post',
})

bulkReverse.form = bulkReverseForm

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDirection
* @see app/Http/Controllers/FlashcardCardController.php:213
* @route '/flashcards/{deck}/cards/bulk-direction'
*/
export const bulkDirection = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkDirection.url(args, options),
    method: 'post',
})

bulkDirection.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/cards/bulk-direction',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDirection
* @see app/Http/Controllers/FlashcardCardController.php:213
* @route '/flashcards/{deck}/cards/bulk-direction'
*/
bulkDirection.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return bulkDirection.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDirection
* @see app/Http/Controllers/FlashcardCardController.php:213
* @route '/flashcards/{deck}/cards/bulk-direction'
*/
bulkDirection.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: bulkDirection.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDirection
* @see app/Http/Controllers/FlashcardCardController.php:213
* @route '/flashcards/{deck}/cards/bulk-direction'
*/
const bulkDirectionForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDirection.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCardController::bulkDirection
* @see app/Http/Controllers/FlashcardCardController.php:213
* @route '/flashcards/{deck}/cards/bulk-direction'
*/
bulkDirectionForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: bulkDirection.url(args, options),
    method: 'post',
})

bulkDirection.form = bulkDirectionForm

const cards = {
    store: Object.assign(store, store),
    import: Object.assign(importMethod, importMethod),
    update: Object.assign(update, update),
    reset: Object.assign(reset, reset),
    move: Object.assign(move, move),
    duplicate: Object.assign(duplicate, duplicate),
    destroy: Object.assign(destroy, destroy),
    bulkDelete: Object.assign(bulkDelete, bulkDelete),
    bulkReset: Object.assign(bulkReset, bulkReset),
    bulkMove: Object.assign(bulkMove, bulkMove),
    bulkReverse: Object.assign(bulkReverse, bulkReverse),
    bulkDirection: Object.assign(bulkDirection, bulkDirection),
}

export default cards