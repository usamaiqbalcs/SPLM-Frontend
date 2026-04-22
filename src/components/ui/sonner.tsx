import { useSyncExternalStore } from 'react';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function subscribeDarkClass(onChange: () => void) {
  const el = document.documentElement;
  const obs = new MutationObserver(() => onChange());
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}

function getDarkSnapshot(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot(): boolean {
  return false;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = useSyncExternalStore(subscribeDarkClass, getDarkSnapshot, getServerSnapshot);

  return (
    <Sonner
      position="top-right"
      theme={isDark ? 'dark' : 'light'}
      richColors
      expand={false}
      closeButton
      duration={5000}
      className="toaster group"
      style={{ zIndex: 9999 }}
      {...props}
    />
  );
};

export { Toaster, toast };
