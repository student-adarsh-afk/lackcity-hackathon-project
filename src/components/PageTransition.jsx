import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'

const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.97,
    filter: 'blur(8px)',
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for premium feel
    },
  },
  exit: {
    opacity: 0,
    scale: 1.02,
    filter: 'blur(8px)',
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const slideUpVariants = {
  initial: {
    opacity: 0,
    y: 50,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -30,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const overlayVariants = {
  initial: {
    scaleY: 1,
  },
  animate: {
    scaleY: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.1,
    },
  },
  exit: {
    scaleY: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

export default function PageTransition({ children }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative"
      >
        {/* Overlay transition effect */}
        <motion.div
          variants={overlayVariants}
          className="fixed inset-0 z-[100] bg-slate-950 origin-top pointer-events-none"
        />
        
        {/* Second overlay for layered effect */}
        <motion.div
          variants={{
            initial: { scaleY: 1 },
            animate: {
              scaleY: 0,
              transition: {
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              },
            },
            exit: {
              scaleY: 1,
              transition: {
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              },
            },
          }}
          className="fixed inset-0 z-[99] bg-indigo-500 origin-top pointer-events-none"
        />

        {/* Page content */}
        <motion.div variants={pageVariants}>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Stagger animation wrapper for child elements
export function StaggerContainer({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        animate: {
          transition: {
            staggerChildren: 0.1,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Individual stagger item
export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div
      variants={slideUpVariants}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Fade in on scroll animation
export function FadeInOnScroll({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Scale on hover animation wrapper
export function HoverScale({ children, className = '', scale = 1.02 }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Magnetic button effect
export function MagneticButton({ children, className = '' }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
