import type { Component, Vec2 } from "@vaguevoid/fiasco"

export type Ship = Component<{ velocity: Vec2 }>
export type Cannon = Component
export type Meteor = Component
export type DestroyedLabel = Component
export type FPSLabel = Component
export type EntityCountLabel = Component
