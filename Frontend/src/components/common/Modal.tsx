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
  sm:    'max-w-sm',
  md:    'max-w-2xl',
  lg:    'max-w-2xl',
  xl:    'max-w-2xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-2xl',
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
          <div className="fixed inset-0 backdrop-blur-[2px]"
               style={{ background: 'rgba(15,17,23,0.5)' }} />
        </Transition.Child>

        {/* Panel container */}
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-[0.97] translate-y-1"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-[0.97] translate-y-1"
          >
            <Dialog.Panel
              className={[
                'w-full bg-white flex flex-col',
                sizeClass[size],
                heightClass || 'max-h-[90vh]',
              ].join(' ')}
              style={{
                borderRadius: '16px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 shrink-0"
                   style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                      {icon}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <Dialog.Title className="text-base font-semibold text-gray-900 tracking-tight">
                      {title}
                    </Dialog.Title>
                    {subtitle && (
                      <p className="text-[11px] text-gray-500 font-medium leading-none mt-1">{subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {actions}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100
                               transition-colors duration-150 border border-transparent hover:border-slate-100"
                    aria-label="Close"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 custom-scrollbar px-6 py-5">
                {children}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
