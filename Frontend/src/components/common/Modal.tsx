import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  actions?: React.ReactNode;
  heightClass?: string;
  icon?: React.ReactNode;
}

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm:    'max-w-md',
  md:    'max-w-xl',
  lg:    'max-w-3xl',
  xl:    'max-w-4xl',
  '2xl': 'max-w-5xl',
  '3xl': 'max-w-6xl',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md', actions, heightClass, icon }: Props) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">

        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 transition-all" />
        </Transition.Child>

        {/* Panel container */}
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-250"
            enterFrom="opacity-0 scale-[0.96] translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-[0.96] translate-y-2"
          >
            <Dialog.Panel
              className={[
                'w-full bg-white flex flex-col rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden font-sans text-slate-800',
                sizeClass[size],
                heightClass || 'max-h-[88vh]',
              ].join(' ')}
            >
              {/* Top Accent Gradient Bar */}
              <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 w-full shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between px-8 py-3.5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 border-b border-slate-200/80 shrink-0">
                <div className="flex items-center gap-3.5">
                  {icon && (
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80 shadow-2xs">
                      {icon}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <Dialog.Title className="text-base font-black text-slate-900 tracking-tight">
                      {title}
                    </Dialog.Title>
                    {subtitle && (
                      <p className="text-xs text-slate-500 font-semibold leading-normal mt-0.5">{subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {actions}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100
                               transition-all duration-150 border border-slate-200/60 hover:border-slate-300 cursor-pointer shadow-2xs"
                    aria-label="Close"
                  >
                    <X size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 custom-scrollbar px-8 pt-3 pb-5 bg-slate-50/30">
                {children}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
