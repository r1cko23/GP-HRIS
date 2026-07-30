import React from "react";
import {
  Plus,
  MagnifyingGlass,
  User,
  PencilSimple,
  Key,
  Power,
  ArrowsClockwise,
  CalendarBlank,
  Check,
  MapPin,
  X,
  CaretRight,
  CaretDown,
  CaretUp,
  Clock,
  SignOut,
  List,
  WarningCircle,
  Timer,
  ChartPieSlice,
  ChatCircleDots,
  ClockClockwise,
  CalendarCheck,
  CurrencyDollarSimple,
  ChartLineUp,
  Gear,
  UsersThree,
  Receipt,
  CaretLeft,
  Buildings,
  FileText,
  Printer,
  Eye,
  CheckCircle,
  Info,
  ArrowLeft,
  Hourglass,
  Paperclip,
  XCircle,
  TrashSimple,
  Trash,
  UserMinus,
  UserPlus,
  DotsThreeVertical,
  FloppyDisk,
  ArrowRight,
  Camera,
  Lock,
  SignIn,
  CalendarX,
  Moon,
  Download,
  FileArrowDown,
  ArrowDown,
  FileCsv,
  FilePdf,
  ShieldCheck,
  Sliders,
  ArrowCounterClockwise,
  DeviceMobile,
  Copy,
  BookOpen,
  RocketLaunch,
} from "phosphor-react";
import { cn } from "@/lib/utils";

const ICONS = {
  Plus,
  MagnifyingGlass,
  User,
  PencilSimple,
  Key,
  Power,
  ArrowsClockwise,
  CalendarBlank,
  Check,
  MapPin,
  X,
  CaretRight,
  CaretDown,
  CaretUp,
  Clock,
  SignOut,
  List,
  WarningCircle,
  Timer,
  ChartPieSlice,
  ChatCircleDots,
  ClockClockwise,
  CalendarCheck,
  CurrencyDollarSimple,
  ChartLineUp,
  Gear,
  UsersThree,
  Receipt,
  CaretLeft,
  Buildings,
  FileText,
  Printer,
  Eye,
  CheckCircle,
  Info,
  ArrowLeft,
  Hourglass,
  Paperclip,
  XCircle,
  TrashSimple,
  Trash,
  UserMinus,
  UserPlus,
  DotsThreeVertical,
  FloppyDisk,
  ArrowRight,
  Camera,
  Lock,
  SignIn,
  CalendarX,
  Moon,
  Download,
  FileArrowDown,
  ArrowDown,
  FileCsv,
  FilePdf,
  ShieldCheck,
  Sliders,
  ArrowCounterClockwise,
  DeviceMobile,
  Copy,
  BookOpen,
  RocketLaunch,
} as const;

export type PhosphorIconName = keyof typeof ICONS;

interface PhosphorIconProps {
  name: PhosphorIconName;
  size?: 16 | 20 | 24 | 32 | 40;
  weight?: "thin" | "light" | "regular" | "bold" | "fill";
  className?: string;
  color?: string;
}

export function Icon({
  name,
  size = 20,
  weight = "regular",
  className = "",
  color,
}: PhosphorIconProps) {
  const IconComponent = ICONS[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Phosphor Icons`);
    return null;
  }

  return (
    <IconComponent
      size={size}
      weight={weight}
      color={color}
      className={cn("inline-block", className)}
    />
  );
}

export const IconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
} as const;
