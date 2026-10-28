import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const SCENARIOS = [
  {
    title: 'SIM_01 : CAFÉ_PARA_LLEVAR',
    steps: [
      { role: 'system', text: 'INICIANDO SIMULACIÓN...' },
      { role: 'bot', text: 'Barista: Welcome! What can I get started for you?' },
      { role: 'user', text: 'Hi, I\'ll have a medium cappuccino, please.' },
      { role: 'bot', text: 'Sure thing. Regular milk or oat milk?' },
      { role: 'user', text: 'Oat milk, and extra hot if possible.' },
      { role: 'bot', text: 'You got it. Anything to eat?' },
      { role: 'user', text: 'No thanks, just the coffee.' },
      { role: 'system', text: 'MISIÓN COMPLETADA. PRECISIÓN: 98%' }
    ]
  },
  {
    title: 'SIM_02 : CONTROL_DE_AEROPUERTO',
    steps: [
      { role: 'system', text: 'CARGANDO PROTOCOLO: SEGURIDAD...' },
      { role: 'bot', text: 'Officer: Boarding pass and ID, please.' },
      { role: 'user', text: 'Here you go.' },
      { role: 'bot', text: 'Are you carrying any liquids?' },
      { role: 'user', text: 'Just a small hand sanitizer.' },
      { role: 'bot', text: 'That\'s fine. Please place your bag on the belt.' },
      { role: 'user', text: 'Do I need to take my laptop out?' },
      { role: 'bot', text: 'Yes, laptop in a separate bin, please.' },
      { role: 'system', text: 'SECUENCIA FINALIZADA.' }
    ]
  },
  {
    title: 'SIM_03 : SOPORTE_TÉCNICO',
    steps: [
      { role: 'system', text: 'CONECTANDO AL NODO DE SOPORTE...' },
      { role: 'bot', text: 'Support: Thank you for calling. How can I help?' },
      { role: 'user', text: 'My internet is not working.' },
      { role: 'bot', text: 'I see. Have you tried restarting the router?' },
      { role: 'user', text: 'Yes, I unplugged it for 10 seconds.' },
      { role: 'bot', text: 'Okay, let me check the signal from here.' },
      { role: 'system', text: 'DIAGNÓSTICO COMPLETADO.' }
    ]
  }
]

export function MissionSimulationAside() {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentScenario = SCENARIOS[scenarioIndex]
  const currentStep = currentScenario.steps[stepIndex]

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    if (isTyping) {
       if (displayedText.length < currentStep.text.length) {
           timeout = setTimeout(() => {
               setDisplayedText(currentStep.text.slice(0, displayedText.length + 1))
           }, 30 + Math.random() * 20)
       } else {
           setIsTyping(false)
       }
    } else {
       timeout = setTimeout(() => {
           if (stepIndex < currentScenario.steps.length - 1) {
               setStepIndex(prev => prev + 1)
               setDisplayedText('')
               setIsTyping(true)
           } else {
               setScenarioIndex(prev => (prev + 1) % SCENARIOS.length)
               setStepIndex(0)
               setDisplayedText('')
               setIsTyping(true)
           }
       }, 2000)
    }

    return () => clearTimeout(timeout)
  }, [displayedText, isTyping, stepIndex, scenarioIndex, currentStep, currentScenario])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [displayedText, stepIndex])

  return (
    <div className="hidden xl:flex w-100 sticky top-8 h-[calc(100vh-13rem)] flex-col gap-4">
       {/* Retro Header */}
      <div className="bg-black/40 border border-cyan/20 p-3 rounded backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan/50 to-transparent animate-scan" style={{ animationDuration: '3s' }} />
         <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-cyan font-mono uppercase tracking-widest">Señal_en_vivo // {currentScenario.title}</span>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-cyan rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-cyan/30 rounded-full" />
            </div>
         </div>
      </div>

      <div className="flex-1 bg-black/20 border border-white/5 rounded-lg overflow-hidden flex flex-col relative shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-10" 
             style={{ backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
        
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide font-mono">
            {currentScenario.steps.slice(0, stepIndex + 1).map((step, idx) => {
                const isLast = idx === stepIndex
                const text = isLast ? displayedText : step.text
                
                if (step.role === 'system') {
                    if (isLast && text.length === 0) return null
                    return (
                        <div key={idx} className="text-center py-4 opacity-70">
                            <span className="text-[9px] text-amber border-y border-amber/30 py-1 px-3 tracking-[0.2em] uppercase">
                                {text}
                            </span>
                        </div>
                    )
                }

                const isBot = step.role === 'bot'
                return (
                    <div key={idx} className={cn("flex flex-col gap-1 max-w-[90%]", isBot ? "self-start items-start" : "self-end items-end")}>
                         <div className={cn("text-[8px] uppercase tracking-wider mb-0.5 px-1", isBot ? "text-cyan" : "text-emerald")}>
                            {isBot ? 'IA_SIMULADA' : 'OPERADOR'}
                         </div>
                         <div className={cn(
                             "py-2 px-3 text-xs leading-relaxed border backdrop-blur-sm shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)] relative",
                             isBot 
                               ? "bg-cyan/5 border-cyan/20 text-cyan-50 rounded-r-lg rounded-bl-lg" 
                               : "bg-emerald/5 border-emerald/20 text-emerald-50 rounded-l-lg rounded-br-lg"
                         )}>
                             {text}
                             {isLast && isTyping && <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-pulse align-middle" />}
                         </div>
                    </div>
                )
            })}
        </div>
        
        {/* Footer Input placeholder */}
        <div className="p-3 border-t border-white/10 bg-black/20 z-20">
            <div className="h-8 border border-white/10 rounded flex items-center px-3 gap-2 opacity-50">
                <span className="text-cyan animate-pulse">{'>'}</span>
                <span className="w-2 h-4 bg-cyan/50 animate-pulse" />
            </div>
        </div>
      </div>
    </div>
  )
}


