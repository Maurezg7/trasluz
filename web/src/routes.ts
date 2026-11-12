/** Loaders de cada ruta: los usa React.lazy y también el prefetch al pasar el mouse por el menú. */
export const routeLoaders = {
	"/": () => import("./pages/Home"),
	"/empresa": () => import("./pages/Empresa"),
	"/proveedor": () => import("./pages/Proveedor"),
	"/auditor": () => import("./pages/Auditor"),
	"/publico": () => import("./pages/Publico"),
	"/admin": () => import("./pages/Admin"),
} as const;

const done = new Set<string>();
export const prefetchRoute = (path: string) => {
	const load = routeLoaders[path as keyof typeof routeLoaders];
	if (!load || done.has(path)) return;
	done.add(path);
	load().catch(() => done.delete(path));
};

/** Después de la primera pintura, precarga en idle el resto de las rutas (conexión no lenta). */
export const prefetchAllIdle = () => {
	const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
	if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;
	const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
	idle(() => Object.keys(routeLoaders).forEach(prefetchRoute), { timeout: 4000 });
};
