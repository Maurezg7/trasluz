import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Skeleton } from "./components/ui";
import { prefetchAllIdle, routeLoaders } from "./routes";

// Code-splitting por ruta: cada rol descarga sólo lo suyo.
const Home = lazy(routeLoaders["/"]);
const Empresa = lazy(routeLoaders["/empresa"]);
const Proveedor = lazy(routeLoaders["/proveedor"]);
const Auditor = lazy(routeLoaders["/auditor"]);
const Publico = lazy(routeLoaders["/publico"]);
const Admin = lazy(routeLoaders["/admin"]);

const Fallback = () => (
	<div className="space-y-4">
		<Skeleton className="h-10 w-2/3" />
		<Skeleton className="h-48" />
	</div>
);

export default function App() {
	useEffect(prefetchAllIdle, []);
	return (
		<Layout>
			<Suspense fallback={<Fallback />}>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/empresa" element={<Empresa />} />
					<Route path="/proveedor" element={<Proveedor />} />
					<Route path="/auditor" element={<Auditor />} />
					<Route path="/publico" element={<Publico />} />
					<Route path="/admin" element={<Admin />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Suspense>
		</Layout>
	);
}
