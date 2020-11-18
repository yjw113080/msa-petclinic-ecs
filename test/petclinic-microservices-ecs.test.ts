import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as PetclinicMicroservicesEcs from '../lib/petclinic-microservices-ecs-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new PetclinicMicroservicesEcs.PetclinicMicroservicesEcsStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
