import { createContext, useContext, useState, type ReactNode } from 'react';


interface User {
    username: string;
    isAuthenticated: boolean;
}

interface AuthContextType {
    user: User | null;
    login: (username: string) => void;
    register: (username: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    // Load user from local storage synchronously during initialization
    const [user, setUser] = useState<User | null>(() => {
        try {
            const storedUser = localStorage.getItem('auth_user');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (e) {
            console.error('Failed to parse user', e);
            localStorage.removeItem('auth_user');
            return null;
        }
    });

    const login = (username: string) => {
        // Simple mock login - in real app would verify credentials
        // For this task: check if user exists in "db" or just allow it as per "register or login"
        // The user request implies "register OR login".
        // Let's simple: Set user state and persist.
        const newUser = { username, isAuthenticated: true };
        setUser(newUser);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        localStorage.setItem('has_registered', 'true'); // Flag to track returning users if needed
    };

    const register = (username: string) => {
        login(username); // For this simple app, register = login
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('auth_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
