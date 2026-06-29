import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/admin',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\AdminController::index
* @see app/Http/Controllers/AdminController.php:16
* @route '/admin'
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
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:166
* @route '/admin/ai-access'
*/
export const toggleAiAccess = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggleAiAccess.url(options),
    method: 'post',
})

toggleAiAccess.definition = {
    methods: ["post"],
    url: '/admin/ai-access',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:166
* @route '/admin/ai-access'
*/
toggleAiAccess.url = (options?: RouteQueryOptions) => {
    return toggleAiAccess.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:166
* @route '/admin/ai-access'
*/
toggleAiAccess.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggleAiAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:166
* @route '/admin/ai-access'
*/
const toggleAiAccessForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggleAiAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggleAiAccess
* @see app/Http/Controllers/AdminController.php:166
* @route '/admin/ai-access'
*/
toggleAiAccessForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggleAiAccess.url(options),
    method: 'post',
})

toggleAiAccess.form = toggleAiAccessForm

/**
* @see \App\Http\Controllers\AdminController::setAccess
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
export const setAccess = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: setAccess.url(options),
    method: 'post',
})

setAccess.definition = {
    methods: ["post"],
    url: '/admin/access',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::setAccess
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
setAccess.url = (options?: RouteQueryOptions) => {
    return setAccess.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::setAccess
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
setAccess.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: setAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::setAccess
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
const setAccessForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: setAccess.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::setAccess
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
setAccessForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: setAccess.url(options),
    method: 'post',
})

setAccess.form = setAccessForm

/**
* @see \App\Http\Controllers\AdminController::storeInvite
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
export const storeInvite = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeInvite.url(options),
    method: 'post',
})

storeInvite.definition = {
    methods: ["post"],
    url: '/admin/invites',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::storeInvite
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
storeInvite.url = (options?: RouteQueryOptions) => {
    return storeInvite.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::storeInvite
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
storeInvite.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: storeInvite.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::storeInvite
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
const storeInviteForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeInvite.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::storeInvite
* @see app/Http/Controllers/AdminController.php:113
* @route '/admin/invites'
*/
storeInviteForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: storeInvite.url(options),
    method: 'post',
})

storeInvite.form = storeInviteForm

/**
* @see \App\Http\Controllers\AdminController::destroyInvite
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
export const destroyInvite = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyInvite.url(args, options),
    method: 'delete',
})

destroyInvite.definition = {
    methods: ["delete"],
    url: '/admin/invites/{invite}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\AdminController::destroyInvite
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroyInvite.url = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return destroyInvite.definition.url
            .replace('{invite}', parsedArgs.invite.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::destroyInvite
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroyInvite.delete = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroyInvite.url(args, options),
    method: 'delete',
})

/**
* @see \App\Http\Controllers\AdminController::destroyInvite
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
const destroyInviteForm = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyInvite.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::destroyInvite
* @see app/Http/Controllers/AdminController.php:135
* @route '/admin/invites/{invite}'
*/
destroyInviteForm.delete = (args: { invite: number | { id: number } } | [invite: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: destroyInvite.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'DELETE',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

destroyInvite.form = destroyInviteForm

const AdminController = { index, toggleAiAccess, setAccess, storeInvite, destroyInvite }

export default AdminController