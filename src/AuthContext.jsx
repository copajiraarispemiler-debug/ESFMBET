import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "./config";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { AuthContext } from "./hooks/useAuthHook"; // Import AuthContext from the new file

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Registro inicial obligatorio
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName, // Estrictamente de Google
          photoURL: result.user.photoURL,
          balones: 0,
          saldo: 0,
          dineroGanado: 0,
          dineroPerdido: 0,
          rol: 'user',
          estadisticas: {
            apuestasRealizadas: 0,
            apuestasGanadas: 0,
            apuestasPerdidas: 0,
            efectividad: 0
          }
        });
      }
    } catch (error) {
      console.error("Error en Login:", error);
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Listener en tiempo real para datos de usuario (puntos/saldo)
        const userRef = doc(db, "users", currentUser.uid);
        onSnapshot(userRef, (doc) => {
          setUser(doc.exists() ? doc.data() : null);
          setLoading(false);
        }, (error) => {
          console.error("Error en listener de usuario:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};