import aiAccess from './ai-access'
import access from './access'
import invites from './invites'

const admin = {
    aiAccess: Object.assign(aiAccess, aiAccess),
    access: Object.assign(access, access),
    invites: Object.assign(invites, invites),
}

export default admin