/**
 * Auth utility for managing user roles and session state in the frontend.
 */

export class Auth {
    static async getUser() {
        try {
            const response = await fetch('/auth/me');
            if (!response.ok) return null;
            const data = await response.json();
            console.log('Auth.getUser response:', data);
            return (data.success && data.data) ? data.data.user : null;
        } catch (error) {
            console.error('Auth.getUser error:', error);
            return null;
        }
    }

    static async checkRole(requiredRole) {
        const user = await this.getUser();
        if (!user) return false;
        
        const roles = ['new', 'host', 'admin'];
        const userRoleIndex = roles.indexOf(user.role);
        const requiredRoleIndex = roles.indexOf(requiredRole);
        
        return userRoleIndex >= requiredRoleIndex;
    }

    /**
     * Dynamically shows/hides elements based on user role.
     * Elements should have a data-role attribute.
     */
    static async syncUI() {
        const user = await this.getUser();
        const role = user ? user.role : 'guest';
        const roleLevel = this.getRoleLevel(role);
        
        document.querySelectorAll('[data-role], [data-role-max]').forEach(el => {
            const minRole = el.getAttribute('data-role');
            const maxRole = el.getAttribute('data-role-max');
            
            const minLevel = minRole ? this.getRoleLevel(minRole) : 0;
            const maxLevel = maxRole ? this.getRoleLevel(maxRole) : 99;
            
            // Show if: UserLevel >= MinLevel AND UserLevel <= MaxLevel
            if (roleLevel >= minLevel && roleLevel <= maxLevel) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    }

    static getRoleLevel(roleName) {
        const roles = { 'guest': 0, 'new': 1, 'host': 2, 'admin': 3 };
        return roles[roleName] || 0;
    }

}
