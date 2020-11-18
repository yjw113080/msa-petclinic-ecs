#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PetclinicMicroservicesEcsStack } from '../lib/petclinic-microservices-ecs-stack';
import {SktDistStack} from '../lib/skt-dist';

const app = new cdk.App();
new PetclinicMicroservicesEcsStack(app, 'PetclinicMicroservicesEcsStack');
new SktDistStack(app, 'SktDistStack')