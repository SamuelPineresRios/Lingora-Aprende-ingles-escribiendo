/**
 * Fondo común de los módulos: el mismo ambiente que usa Misiones.
 *
 * Gradiente espacial, rejilla enmascarada, hilos de datos, brillos ambientales
 * y los avatares voxel que pasean por el fondo. Es decorativo y no captura
 * el ratón (`pointer-events-none`), así que las páginas solo tienen que
 * montarlo detrás de su contenido (`relative z-10`).
 */
import { ResponsiveBackgroundSprites } from '@/components/layout/ResponsiveBackgroundSprites'

export function ModuleBackdrop() {
  return (
    <div data-module-backdrop className="fixed inset-0 z-0 pointer-events-none">
      {/* Deep Space Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,#020617_100%)]" />

      {/* Animated Grid System */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />

      {/* Floating Particles / Data Streams */}
      <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-cyan/20 to-transparent opacity-30 animate-pulse delay-700" />
      <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-violet/20 to-transparent opacity-30 animate-pulse delay-300" />
      <div
        className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald/10 to-transparent opacity-20 animate-ping"
        style={{ animationDuration: '8s' }}
      />

      {/* Ambient Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] animate-pulse delay-1000" />

      {/* 👾 Voxel Avatars Layer - Desktop Only */}
      <div className="absolute inset-0 z-10 opacity-70">
        <ResponsiveBackgroundSprites />
      </div>
    </div>
  )
}
