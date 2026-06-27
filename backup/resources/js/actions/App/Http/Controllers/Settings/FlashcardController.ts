import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../../wayfinder'
/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
export const edit = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/settings/flashcards',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
edit.url = (options?: RouteQueryOptions) => {
    return edit.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
edit.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
edit.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
const editForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
editForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::edit
* @see app/Http/Controllers/Settings/FlashcardController.php:15
* @route '/settings/flashcards'
*/
editForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: edit.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

edit.form = editForm

/**
* @see \App\Http\Controllers\Settings\FlashcardController::update
* @see app/Http/Controllers/Settings/FlashcardController.php:43
* @route '/settings/flashcards'
*/
export const update = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/settings/flashcards',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Settings\FlashcardController::update
* @see app/Http/Controllers/Settings/FlashcardController.php:43
* @route '/settings/flashcards'
*/
update.url = (options?: RouteQueryOptions) => {
    return update.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Settings\FlashcardController::update
* @see app/Http/Controllers/Settings/FlashcardController.php:43
* @route '/settings/flashcards'
*/
update.put = (options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(options),
    method: 'put',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::update
* @see app/Http/Controllers/Settings/FlashcardController.php:43
* @route '/settings/flashcards'
*/
const updateForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\Settings\FlashcardController::update
* @see app/Http/Controllers/Settings/FlashcardController.php:43
* @route '/settings/flashcards'
*/
updateForm.put = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PUT',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

const FlashcardController = { edit, update }

export default FlashcardController