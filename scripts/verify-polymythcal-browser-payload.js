#!/usr/bin/env node
'use strict';

/*
 * Compatibility entry point. Discovery v2 replaced the unsafe v1 projection;
 * keep every historical build caller routed through the stricter current gate.
 */
require('./verify-polymythcal-discovery-v2.js');

