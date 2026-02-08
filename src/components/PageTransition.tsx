"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export default function PageTransition({
  children,
  ...props
}: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
