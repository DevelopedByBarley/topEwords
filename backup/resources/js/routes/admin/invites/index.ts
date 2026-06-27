import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\AdminController::store
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/admin/invites',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::store
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::store
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::store
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::store
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: store.url(options),
    method: 'post',
})

store.form = storeForm

/**
* @see \App\Http\Controllers\AdminController::destroy
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
export const destroy = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/admin/invites/{invite}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\AdminController::destroy
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroy.url = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { invite: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { invite: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            invite: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        invite: typeof args.invite === 'object'
        ? args.invite.id
        : args.invite,
    }

    return destroy.definition.url
            .replace('{invite}', parsedArgs.invite.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::destroy
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroy.delete = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\AdminController::destroy
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
const destroyForm = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::destroy
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroyForm.delete = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroy.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroy.form = destroyForm

const invites = {
    store: Object.assign(store, store),
    destroy: Object.assign(destroy, destroy),
}

export default invites