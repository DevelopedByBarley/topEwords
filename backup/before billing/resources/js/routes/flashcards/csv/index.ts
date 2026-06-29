import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardCsvController::importMethod
* @see app/Http/Controllers/FlashcardCsvController.php:22
* @route '/flashcards/{deck}/csv-import'
*/
export const importMethod = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importMethod.url(args, options),
    method: 'post',
})

importMethod.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/csv-import',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCsvController::importMethod
* @see app/Http/Controllers/FlashcardCsvController.php:22
* @route '/flashcards/{deck}/csv-import'
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
* @see \App\Http\Controllers\FlashcardCsvController::importMethod
* @see app/Http/Controllers/FlashcardCsvController.php:22
* @route '/flashcards/{deck}/csv-import'
*/
importMethod.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importMethod.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::importMethod
* @see app/Http/Controllers/FlashcardCsvController.php:22
* @route '/flashcards/{deck}/csv-import'
*/
const importMethodForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importMethod.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::importMethod
* @see app/Http/Controllers/FlashcardCsvController.php:22
* @route '/flashcards/{deck}/csv-import'
*/
importMethodForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importMethod.url(args, options),
    method: 'post',
})

importMethod.form = importMethodForm

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
export const exportMethod = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: exportMethod.url(args, options),
    method: 'get',
})

exportMethod.definition = {
    methods: ["get","head"],
    url: '/flashcards/{deck}/csv-export',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
exportMethod.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return exportMethod.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
exportMethod.get = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: exportMethod.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
exportMethod.head = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: exportMethod.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
const exportMethodForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: exportMethod.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
exportMethodForm.get = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: exportMethod.url(args, options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\FlashcardCsvController::exportMethod
* @see app/Http/Controllers/FlashcardCsvController.php:111
* @route '/flashcards/{deck}/csv-export'
*/
exportMethodForm.head = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: exportMethod.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

exportMethod.form = exportMethodForm

const csv = {
    import: Object.assign(importMethod, importMethod),
    export: Object.assign(exportMethod, exportMethod),
}

export default csv