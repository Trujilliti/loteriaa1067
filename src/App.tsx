import React, { useState, useEffect, useRef } from "react";
import {
  Car,
  TreeDeciduous,
  Nut,
  MapPin,
  Save,
  Database,
  Wifi,
  Ticket,
  Map,
  MessageSquare,
} from "lucide-react";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCAo2Yll-qVW637qqOoTvnGBgsshgo3zcE",
  authDomain: "loteria1067.firebaseapp.com",
  databaseURL: "https://loteria1067-default-rtdb.firebaseio.com",
  projectId: "loteria1067",
  storageBucket: "loteria1067.firebasestorage.app",
  messagingSenderId: "427492885817",
  appId: "1:427492885817:web:8238e82ffebc3c007154e8",
  measurementId: "G-799LTWD2ZL",
};

const FONDO_URL =
  "https://images.unsplash.com/photo-1543335785-84f71a0be306?q=80&w=1920&auto=format&fit=crop";

const COMUNIDADES = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Baleares",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Extremadura",
  "Galicia",
  "Madrid",
  "Murcia",
  "Navarra",
  "País Vasco",
  "La Rioja",
  "Valencia",
];

// --- SINGLETON LOADERS PARA EVITAR DUPLICIDADES EN MÓVILES ---
let mapResourcesPromise: Promise<any> | null = null;

function getMapResources() {
  if (!mapResourcesPromise) {
    mapResourcesPromise = Promise.all([
      new Promise((resolve) => {
        if (window.hasOwnProperty("d3")) {
          resolve((window as any).d3);
        } else {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js";
          script.onload = () => resolve((window as any).d3);
          document.head.appendChild(script);
        }
      }),
      new Promise((resolve) => {
        if (window.hasOwnProperty("topojson")) {
          resolve((window as any).topojson);
        } else {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
          script.onload = () => resolve((window as any).topojson);
          document.head.appendChild(script);
        }
      }),
      fetch(
        "https://cdn.jsdelivr.net/npm/es-atlas@0.3.0/es/autonomous_regions.json"
      ).then((res) => res.json()),
    ]);
  }
  return mapResourcesPromise;
}

// Función ultra robusta para obtener la Comunidad Autónoma a partir del feature de D3
function getFeatureCommunity(d: any): string | undefined {
  if (!d) return undefined;

  let id = d.id;
  if (typeof id === "number") id = id < 10 ? "0" + id : String(id);
  const idToName: Record<string, string> = {
    "01": "Andalucía",
    "02": "Aragón",
    "03": "Asturias",
    "04": "Baleares",
    "05": "Canarias",
    "06": "Cantabria",
    "07": "Castilla y León",
    "08": "Castilla-La Mancha",
    "09": "Cataluña",
    "10": "Valencia",
    "11": "Extremadura",
    "12": "Galicia",
    "13": "Madrid",
    "14": "Murcia",
    "15": "Navarra",
    "16": "País Vasco",
    "17": "La Rioja",
  };
  if (id && idToName[id]) return idToName[id];

  const props = d.properties || {};
  const namesToTry = [
    props.name,
    props.NAME,
    props.NAME_1,
    props.NAMEUNIT,
    props.Comunidad,
  ].filter(Boolean);

  for (const n of namesToTry) {
    const lower = String(n).toLowerCase();
    if (lower.includes("andaluc")) return "Andalucía";
    if (lower.includes("arag")) return "Aragón";
    if (lower.includes("astur")) return "Asturias";
    if (lower.includes("balear") || lower.includes("illes")) return "Baleares";
    if (lower.includes("canari")) return "Canarias";
    if (lower.includes("cantab")) return "Cantabria";
    if (lower.includes("mancha")) return "Castilla-La Mancha";
    if (lower.includes("león") || lower.includes("leon"))
      return "Castilla y León";
    if (lower.includes("catalu") || lower.includes("catalunya"))
      return "Cataluña";
    if (lower.includes("valenc")) return "Valencia";
    if (lower.includes("extremadura")) return "Extremadura";
    if (lower.includes("galicia")) return "Galicia";
    if (lower.includes("madrid")) return "Madrid";
    if (lower.includes("murcia")) return "Murcia";
    if (lower.includes("navar") || lower.includes("foral")) return "Navarra";
    if (lower.includes("vasc") || lower.includes("euskadi"))
      return "País Vasco";
    if (lower.includes("rioja")) return "La Rioja";
  }
  return undefined;
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 255,
    ag = (ah >> 8) & 255,
    ab = ah & 255;
  const br = (bh >> 16) & 255,
    bg = (bh >> 8) & 255,
    bb = bh & 255;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

// --- COMPONENTE MAPA SVG INTERACTIVO ---
function MapaEspana({ agrupado }: { agrupado: Record<string, number> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;
    if (!container) return;

    const maxVal = Math.max(...Object.values(agrupado), 1);

    const getColor = (formName: string | undefined): string => {
      if (!formName) return "#f1f5f9";
      const val = agrupado[formName] || 0;
      if (val === 0) return "#e5e7eb";
      const t = Math.min(val / maxVal, 1);
      return lerpColor("#fca5a5", "#991b1b", t);
    };

    const getTextColor = (formName: string | undefined): string => {
      if (!formName) return "#94a3b8";
      const val = agrupado[formName] || 0;
      if (val === 0) return "#94a3b8";
      const t = Math.min(val / maxVal, 1);
      return t > 0.5 ? "#ffffff" : "#7f1d1d";
    };

    getMapResources()
      .then(([d3, topojson, es]) => {
        if (!isMounted || !container) return;

        d3.select(container).selectAll("*").remove();
        container.innerHTML = "";

        const objectKey = Object.keys(es.objects)[0];
        const allFeatures = topojson.feature(
          es,
          es.objects[objectKey]
        ).features;

        const isCanarias = (f: any) => getFeatureCommunity(f) === "Canarias";
        const isPeninsula = (f: any) => {
          const comm = getFeatureCommunity(f);
          return comm && comm !== "Canarias";
        };

        const peninsulaFeatures = allFeatures.filter(isPeninsula);
        const canariasFeature = allFeatures.find(isCanarias);

        const W = 800;
        const H = 600;

        const svg = d3
          .select(container)
          .append("svg")
          .attr("viewBox", `0 0 ${W} ${H}`)
          .attr("preserveAspectRatio", "xMidYMid meet")
          .style("width", "100%")
          .style("height", "auto")
          .style("display", "block");

        const projPeninsula = d3.geoMercator().fitExtent(
          [
            [20, 20],
            [W - 20, H - 20],
          ],
          { type: "FeatureCollection", features: peninsulaFeatures }
        );
        const pathPeninsula = d3.geoPath(projPeninsula);

        const insetW = 200;
        const insetH = 110;
        const insetX = 20;
        const insetY = H - insetH - 20;

        let pathCanarias: any = null;
        if (canariasFeature) {
          const projCanarias = d3.geoMercator().fitExtent(
            [
              [insetX + 10, insetY + 10],
              [insetX + insetW - 10, insetY + insetH - 10],
            ],
            canariasFeature
          );
          pathCanarias = d3.geoPath(projCanarias);
        }

        const tooltip = tooltipRef.current;
        const showTooltip = (event: any, formName: string | undefined) => {
          if (!tooltip || !formName) return;
          const val = agrupado[formName] || 0;
          tooltip.style.display = "block";
          tooltip.innerHTML = `<span style="font-weight:700">${formName}</span><br/>${
            val > 0 ? `${val} décimo${val === 1 ? "" : "s"}` : "Sin décimos"
          }`;

          const [mx, my] = d3.pointer(event, container);
          let left = mx + 15;
          if (left + 130 > container.clientWidth) {
            left = mx - 145;
          }
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${my - 55}px`;
        };
        const hideTooltip = () => {
          if (tooltip) tooltip.style.display = "none";
        };

        svg
          .selectAll("path.peninsula")
          .data(peninsulaFeatures)
          .join("path")
          .attr("class", "peninsula")
          .attr("d", pathPeninsula)
          .attr("fill", (d: any) => getColor(getFeatureCommunity(d)))
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5)
          .style("cursor", "pointer")
          .style("transition", "fill 0.3s ease")
          .on("mousemove touchstart", (event: any, d: any) =>
            showTooltip(event, getFeatureCommunity(d))
          )
          .on("mouseleave touchend", hideTooltip);

        svg
          .selectAll("text.label-peninsula")
          .data(
            peninsulaFeatures.filter((d: any) => {
              const fn = getFeatureCommunity(d);
              return fn && (agrupado[fn] || 0) > 0;
            })
          )
          .join("text")
          .attr("class", "label-peninsula")
          .attr(
            "transform",
            (d: any) => `translate(${pathPeninsula.centroid(d)})`
          )
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size", 14)
          .attr("font-weight", "800")
          .attr("fill", (d: any) => getTextColor(getFeatureCommunity(d)))
          .attr("pointer-events", "none")
          .text((d: any) => agrupado[getFeatureCommunity(d) as string] || "");

        if (canariasFeature && pathCanarias) {
          svg
            .append("rect")
            .attr("x", insetX)
            .attr("y", insetY)
            .attr("width", insetW)
            .attr("height", insetH)
            .attr("fill", "#f8fafc")
            .attr("stroke", "#cbd5e1")
            .attr("stroke-width", 1)
            .attr("rx", 6);

          const formNameCanarias = "Canarias";
          svg
            .append("path")
            .datum(canariasFeature)
            .attr("d", pathCanarias)
            .attr("fill", getColor(formNameCanarias))
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mousemove touchstart", (event: any) =>
              showTooltip(event, formNameCanarias)
            )
            .on("mouseleave touchend", hideTooltip);

          const valCanarias = agrupado[formNameCanarias] || 0;
          if (valCanarias > 0) {
            const [cx, cy] = pathCanarias.centroid(canariasFeature);
            svg
              .append("text")
              .attr("x", cx)
              .attr("y", cy)
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "central")
              .attr("font-size", 12)
              .attr("font-weight", "800")
              .attr("fill", getTextColor(formNameCanarias))
              .attr("pointer-events", "none")
              .text(valCanarias);
          }

          svg
            .append("text")
            .attr("x", insetX + insetW / 2)
            .attr("y", insetY + insetH - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", 12)
            .attr("font-weight", "600")
            .attr("fill", "#94a3b8")
            .text("Canarias");
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [agrupado]);

  const maxVal = Math.max(...Object.values(agrupado), 1);

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-auto bg-slate-50/50 rounded-2xl"
      />
      <div
        ref={tooltipRef}
        style={{ display: "none", position: "absolute" }}
        className="pointer-events-none bg-white text-slate-800 text-sm px-4 py-2 rounded-xl shadow-xl border border-slate-200 z-10 whitespace-nowrap"
      />
      <div className="mt-4 flex items-center gap-3 text-sm text-slate-600 px-2 font-medium">
        <span>0</span>
        <div
          className="flex-1 h-3 rounded-full shadow-inner"
          style={{ background: "linear-gradient(to right, #fca5a5, #991b1b)" }}
        />
        <span>{maxVal}</span>
        <span className="ml-4 flex items-center gap-2">
          <span
            className="inline-block rounded-md border border-gray-300 shadow-sm"
            style={{ width: 14, height: 14, background: "#e5e7eb" }}
          />
          Sin décimos
        </span>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [datos, setDatos] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nombre: "",
    comunidad: "Madrid",
    cantidad: "",
  });
  const [nuevaIdea, setNuevaIdea] = useState("");
  const [dbStatus, setDbStatus] = useState<"local" | "firebase">("local");
  const [activeTab, setActiveTab] = useState<"registro" | "mapa" | "ideas">(
    "registro"
  );

  useEffect(() => {
    let unsubscribeRegistrations: any;
    let unsubscribeIdeas: any;

    if (firebaseConfig) {
      try {
        const { initializeApp } = require("firebase/app");
        const {
          getFirestore,
          collection,
          onSnapshot,
          orderBy,
          query,
        } = require("firebase/firestore");
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // Listener para los registros
        const colRef = collection(db, "registrations");
        unsubscribeRegistrations = onSnapshot(
          colRef,
          (snapshot: any) => {
            const fetched = snapshot.docs.map((doc: any) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setDatos(fetched);
            setDbStatus("firebase");
          },
          (error: any) => {
            console.error(
              "Error al conectar con Firestore (registrations):",
              error
            );
            setDbStatus("local");
            loadLocalData();
          }
        );

        // Listener para las ideas del muro
        const ideasRef = query(
          collection(db, "ideas"),
          orderBy("timestamp", "desc")
        );
        unsubscribeIdeas = onSnapshot(
          ideasRef,
          (snapshot: any) => {
            const fetchedIdeas = snapshot.docs.map((doc: any) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setIdeas(fetchedIdeas);
          },
          (error: any) => {
            console.error("Error al conectar con Firestore (ideas):", error);
            loadLocalIdeas();
          }
        );
      } catch (e) {
        console.error("Error inicializando Firebase:", e);
        setDbStatus("local");
        loadLocalData();
        loadLocalIdeas();
      }
    } else {
      setDbStatus("local");
      loadLocalData();
      loadLocalIdeas();
    }

    return () => {
      if (unsubscribeRegistrations) unsubscribeRegistrations();
      if (unsubscribeIdeas) unsubscribeIdeas();
    };
  }, []);

  const loadLocalData = () => {
    const saved = localStorage.getItem("loteriaData2026");
    if (saved) setDatos(JSON.parse(saved));
  };

  const loadLocalIdeas = () => {
    const savedIdeas = localStorage.getItem("loteriaIdeas2026");
    if (savedIdeas) setIdeas(JSON.parse(savedIdeas));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.cantidad) return;
    const nuevoRegistro = {
      nombre: formData.nombre,
      comunidad: formData.comunidad,
      cantidad: parseInt(formData.cantidad),
      timestamp: Date.now(),
    };
    try {
      if (dbStatus === "firebase") {
        const {
          getFirestore,
          collection,
          addDoc,
        } = require("firebase/firestore");
        await addDoc(
          collection(getFirestore(), "registrations"),
          nuevoRegistro
        );
      } else {
        const nuevosDatos = [...datos, nuevoRegistro];
        setDatos(nuevosDatos);
        localStorage.setItem("loteriaData2026", JSON.stringify(nuevosDatos));
      }
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      const nuevosDatos = [...datos, nuevoRegistro];
      setDatos(nuevosDatos);
      localStorage.setItem("loteriaData2026", JSON.stringify(nuevosDatos));
      setDbStatus("local");
    }
    setFormData({ nombre: "", comunidad: "Madrid", cantidad: "" });
  };

  const handleIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaIdea.trim()) return;

    const coloresPostIt = [
      "bg-yellow-100",
      "bg-pink-100",
      "bg-blue-100",
      "bg-green-100",
      "bg-purple-100",
    ];
    const colorElegido =
      coloresPostIt[Math.floor(Math.random() * coloresPostIt.length)];
    const rotacionAleatoria = Math.floor(Math.random() * 12) - 6; // Entre -6 y +6 grados

    const nuevaIdeaObj = {
      texto: nuevaIdea,
      color: colorElegido,
      rotacion: rotacionAleatoria,
      timestamp: Date.now(),
    };

    try {
      if (dbStatus === "firebase") {
        const {
          getFirestore,
          collection,
          addDoc,
        } = require("firebase/firestore");
        await addDoc(collection(getFirestore(), "ideas"), nuevaIdeaObj);
      } else {
        const nuevasIdeas = [nuevaIdeaObj, ...ideas];
        setIdeas(nuevasIdeas);
        localStorage.setItem("loteriaIdeas2026", JSON.stringify(nuevasIdeas));
      }
    } catch (error) {
      console.error("Error guardando la idea:", error);
      const nuevasIdeas = [nuevaIdeaObj, ...ideas];
      setIdeas(nuevasIdeas);
      localStorage.setItem("loteriaIdeas2026", JSON.stringify(nuevasIdeas));
    }
    setNuevaIdea("");
  };

  const totalDecimos = datos.reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0),
    0
  );
  const agrupado = datos.reduce((acc: any, item) => {
    acc[item.comunidad] =
      (acc[item.comunidad] || 0) + (Number(item.cantidad) || 0);
    return acc;
  }, {});

  return (
    <div className="min-h-[100dvh] text-slate-800 p-2 sm:p-4 md:p-8 font-sans relative z-0 bg-slate-50 flex flex-col">
      {/* IMAGEN DE FONDO */}
      <div
        className={`fixed inset-0 w-full h-full -z-10 transition-opacity duration-700 pointer-events-none ${
          activeTab === "registro" ? "opacity-100" : "opacity-0 md:opacity-30"
        }`}
        style={{
          backgroundImage: `url("${FONDO_URL}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="w-full max-w-5xl mx-auto bg-white/90 md:bg-white/85 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-10 shadow-2xl border border-white/50 relative mt-2 md:mt-4 flex-grow">
        <header className="text-center mb-6 md:mb-10">
          <div
            className={`inline-flex items-center gap-1 md:gap-2 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase mb-4 shadow-sm ${
              dbStatus === "firebase"
                ? "bg-green-100 text-green-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {dbStatus === "firebase" ? (
              <>
                <Database className="w-3 h-3" /> Conectado a DB
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3" /> Modo Local
              </>
            )}
          </div>
          <div className="flex justify-center gap-3 md:gap-4 mb-3 md:mb-4">
            <Car className="text-red-700 w-8 h-8 md:w-10 md:h-10 drop-shadow-sm" />
            <TreeDeciduous className="text-red-700 w-8 h-8 md:w-10 md:h-10 drop-shadow-sm" />
            <Nut className="text-red-700 w-8 h-8 md:w-10 md:h-10 drop-shadow-sm" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-red-700 tracking-tight drop-shadow-sm">
            El 1067 de Pedro y pablo
          </h1>
        </header>

        {/* NAVEGACIÓN */}
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mb-6 md:mb-8">
          <button
            onClick={() => setActiveTab("registro")}
            className={`flex items-center justify-center gap-2 px-4 py-3 md:px-6 rounded-xl md:rounded-2xl font-bold transition-all ${
              activeTab === "registro"
                ? "bg-red-600 text-white shadow-lg md:scale-105"
                : "bg-white/90 text-slate-600 hover:bg-white shadow-sm border border-slate-100"
            }`}
          >
            <Ticket className="w-5 h-5" /> Registro
          </button>
          <button
            onClick={() => setActiveTab("mapa")}
            className={`flex items-center justify-center gap-2 px-4 py-3 md:px-6 rounded-xl md:rounded-2xl font-bold transition-all ${
              activeTab === "mapa"
                ? "bg-red-600 text-white shadow-lg md:scale-105"
                : "bg-white/90 text-slate-600 hover:bg-white shadow-sm border border-slate-100"
            }`}
          >
            <Map className="w-5 h-5" /> Distribución
          </button>
          <button
            onClick={() => setActiveTab("ideas")}
            className={`flex items-center justify-center gap-2 px-4 py-3 md:px-6 rounded-xl md:rounded-2xl font-bold transition-all ${
              activeTab === "ideas"
                ? "bg-red-600 text-white shadow-lg md:scale-105"
                : "bg-white/90 text-slate-600 hover:bg-white shadow-sm border border-slate-100"
            }`}
          >
            <MessageSquare className="w-5 h-5" /> Qué Harías
          </button>
        </div>

        {/* ── PESTAÑA: REGISTRO ── */}
        {activeTab === "registro" && (
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 animate-in fade-in duration-500">
            <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl border border-white/60">
              <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
                Mi Décimo
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  required
                  className="w-full p-3 md:p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-400 outline-none text-sm md:text-base"
                />
                <select
                  value={formData.comunidad}
                  onChange={(e) =>
                    setFormData({ ...formData, comunidad: e.target.value })
                  }
                  className="w-full p-3 md:p-4 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-red-400 outline-none text-sm md:text-base"
                >
                  {COMUNIDADES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Cantidad"
                  min="1"
                  required
                  value={formData.cantidad}
                  onChange={(e) =>
                    setFormData({ ...formData, cantidad: e.target.value })
                  }
                  className="w-full p-3 md:p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-400 outline-none text-sm md:text-base"
                />
                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 md:py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md text-sm md:text-base"
                >
                  <Save className="w-4 h-4 md:w-5 md:h-5" /> Registrar Suerte
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-4 md:p-8 rounded-2xl md:rounded-3xl flex flex-col justify-center items-center shadow-md border border-white/60">
                <p className="text-[10px] md:text-sm uppercase tracking-widest text-slate-500 font-semibold text-center">
                  Total Vendido
                </p>
                <p className="text-4xl md:text-6xl font-extrabold text-red-600 mt-1 md:mt-2">
                  {totalDecimos}
                </p>
              </div>
              <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-4 md:p-8 rounded-2xl md:rounded-3xl flex flex-col justify-center items-center shadow-md border border-white/60">
                <p className="text-[10px] md:text-sm uppercase tracking-widest text-slate-500 font-semibold text-center">
                  Progreso
                </p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mt-1 md:mt-2">
                  {((totalDecimos / 1980) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="col-span-2 bg-gradient-to-br from-red-600 to-red-800 p-5 md:p-8 rounded-2xl md:rounded-3xl text-white flex flex-col justify-center items-center shadow-xl">
                <p className="text-sm md:text-lg font-medium opacity-90 mb-1 md:mb-2 text-center">
                  Décimos Disponibles
                </p>
                <p className="text-4xl md:text-5xl font-black">
                  {Math.max(1980 - totalDecimos, 0)}
                </p>
                <p className="text-xs md:text-sm mt-2 md:mt-3 text-red-200 text-center">
                  De un total de 1980 décimos emitidos
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PESTAÑA: MAPA ── */}
        {activeTab === "mapa" && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-xl border border-white/60">
              <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <MapPin className="text-red-600 w-5 h-5" /> Distribución por
                comunidad
              </h2>
              <MapaEspana agrupado={agrupado} />
            </div>

            {/* Ranking */}
            <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-white/60">
              <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">
                Ranking de Ventas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                {Object.entries(agrupado)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([comunidad, cant], idx) => (
                    <div
                      key={comunidad}
                      className="flex justify-between items-center p-3 md:p-4 bg-white rounded-xl shadow-sm border border-slate-100"
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <span className="text-base font-bold text-slate-400 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-lg shrink-0">
                          {comunidad === "Madrid" ? "🚕" : "📍"}
                        </span>
                        <span className="font-semibold text-slate-700 text-sm md:text-base truncate">
                          {comunidad}
                        </span>
                      </div>
                      <span className="font-black text-red-600 bg-red-50 px-2 md:px-3 py-1 rounded-lg text-sm md:text-base shrink-0 ml-2">
                        {String(cant)}
                      </span>
                    </div>
                  ))}
                {Object.keys(agrupado).length === 0 && (
                  <p className="text-slate-500 col-span-full text-center py-6 text-sm md:text-base">
                    Aún no hay décimos registrados en la base de datos.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PESTAÑA: IDEAS / QUÉ HARÍAS ── */}
        {activeTab === "ideas" && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            {/* Formulario para añadir idea */}
            <div className="bg-white/90 md:bg-white/80 backdrop-blur-lg p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border border-white/60">
              <h2 className="text-xl md:text-2xl font-bold mb-2 text-slate-800">
                ¿Qué harías si nos toca el Gordo? 💭
              </h2>
              <p className="text-sm text-slate-500 mb-4 md:mb-6">
                Comparte tu sueño de forma anónima con el resto de
                participantes.
              </p>
              <form
                onSubmit={handleIdeaSubmit}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  placeholder="Ej: Dar la vuelta al mundo en un velero..."
                  value={nuevaIdea}
                  onChange={(e) => setNuevaIdea(e.target.value)}
                  maxLength={120}
                  required
                  className="flex-1 p-3 md:p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-400 outline-none text-sm md:text-base"
                />
                <button
                  type="submit"
                  className="bg-red-600 text-white px-6 py-3 md:py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center shadow-md text-sm md:text-base shrink-0 whitespace-nowrap"
                >
                  Colgar en el muro
                </button>
              </form>
            </div>

            {/* Muro de corcho (Grid de Post-its) */}
            <div className="bg-[#f0e6d2] p-6 md:p-10 rounded-2xl md:rounded-3xl shadow-inner border-4 border-[#d4c3a3] min-h-[400px] flex flex-wrap gap-4 md:gap-6 justify-center items-start content-start relative overflow-hidden">
              {/* Textura sutil para el fondo simulando corcho/pared */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(#8c7b5f 1px, transparent 1px)",
                  backgroundSize: "10px 10px",
                }}
              />

              {ideas.map((idea, index) => (
                <div
                  key={idea.id || index}
                  className={`w-40 h-40 md:w-48 md:h-48 ${idea.color} p-4 md:p-5 shadow-md flex items-center justify-center relative transition-transform hover:scale-105 hover:z-10 z-0`}
                  style={{ transform: `rotate(${idea.rotacion || 0}deg)` }}
                >
                  {/* Sombra interna para darle volumen al post-it */}
                  <div className="absolute inset-0 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.03)] pointer-events-none" />

                  {/* Chincheta simulada (opcional, visual) */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-400/80 shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />

                  <p className="font-medium text-slate-700 text-center text-sm md:text-base leading-snug break-words w-full z-10">
                    {idea.texto}
                  </p>
                </div>
              ))}

              {ideas.length === 0 && (
                <div className="flex flex-col items-center justify-center w-full h-48 opacity-60 z-10">
                  <MessageSquare className="w-10 h-10 text-slate-500 mb-3" />
                  <p className="text-slate-600 font-medium text-center">
                    El muro está vacío.
                    <br />
                    ¡Sé el primero en colgar tu sueño!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
