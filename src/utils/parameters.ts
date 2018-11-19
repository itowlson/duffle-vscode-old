import { ParameterDefinition, BundleManifest } from "../duffle/duffle.objectmodel";
import { BundleSelection } from "./bundleselection";
import { END_DIALOG_FN, dialog } from "./dialog";
import { Cancellable } from './cancellable';

export type ParameterValuesPromptResult = Cancellable<{ [key: string]: string }>;

interface ParameterDefinitionMapping extends ParameterDefinition {
    readonly name: string;
}

const PARAMETER_FORM_ID = 'pvform';

export async function promptForParameters(bundlePick: BundleSelection, bundleManifest: BundleManifest, actionName: string, prompt: string): Promise<ParameterValuesPromptResult> {
    const definitions = parseParameters(bundleManifest);
    if (!definitions || definitions.length === 0) {
        return { cancelled: false, value: {} };
    }

    const parameterFormId = PARAMETER_FORM_ID;

    const html = `<h1>${prompt}</h1>
    ${validationScript(definitions)}
    <form id='${parameterFormId}'>
    ${parameterEntryTable(definitions)}
    </form>
    <p><button onclick='${END_DIALOG_FN}'>${actionName}</button></p>`;

    const parameterValues = await dialog(`${actionName} ${bundlePick.label}`, html, parameterFormId);
    if (!parameterValues) {
        return { cancelled: true };
    }

    return { cancelled: false, value: parameterValues };
}

function parameterEntryTable(ps: ParameterDefinitionMapping[]): string {
    const rows = ps.map(parameterEntryRow).join('');
    return `<table>${rows}</table>`;
}

function parameterEntryRow(p: ParameterDefinitionMapping): string {
    return `<tr valign="baseline">
    <td><b>${p.name}</b></td>
    <td>${inputWidget(p)}</td>
</tr>
<tr>
    <td colspan="2" style="font-size:80%">${p.metadata ? (p.metadata.description || '') : ''}</td>
</tr>
`;
}

function inputWidget(p: ParameterDefinitionMapping): string {
    if (p.type === "bool") {
        return `<select name="${p.name}"><option>True</option><option>False</option></select>`;
    }
    if (p.allowedValues) {
        const opts = p.allowedValues.map((av) => `<option>${av}</option>`).join('');
        return `<select name="${p.name}">${opts}</select>`;
    }
    const defval = p.defaultValue ? `${p.defaultValue}` : '';
    return `<input name="${p.name}" type="text" value="${defval}" /><span id="${p.name}_validation_display" />`;
}

function validationScript(ps: ParameterDefinitionMapping[]): string {
    return `<script>
window.addEventListener('input', function(e) { validate(); }, false);
function validate() {
    ${validationScriptLines(ps)}
}
</script>`;
}

function validationScriptLines(ps: ParameterDefinitionMapping[]): string {
    return `for (const e of document.forms['${PARAMETER_FORM_ID}'].elements) {
        ${ps.map(validationScriptLine).join('\n')};
    }`;
}

function validationScriptLine(p: ParameterDefinitionMapping): string {
    const body = validationCode(p);
    if (body && body.length > 0) {
        return `if (e.name === '${p.name}') {
            ${body}
        }`;
    }
    return '';
}

function validationCode(p: ParameterDefinitionMapping): string | undefined {
    if (p.type === "bool" || p.allowedValues) {
        return undefined;
    }
    const validationElementID = `${p.name}_validation_display`;
    const validationMessageProperty = `document.getElementById('${validationElementID}').innerText`;
    if (p.type === "int") {
        let code = `
        ${validationMessageProperty} = '';
        nval = Number.parseInt(e.value);
        if (isNaN(nval)) { ${validationMessageProperty} = 'Must be a number'; }
        `;
        if (p.minValue !== undefined) {
            code += `if (nval < ${p.minValue}) { ${validationMessageProperty} = 'Must be at least ${p.minValue}'; }
            `;
        }
        if (p.maxValue !== undefined) {
            code += `if (nval > ${p.maxValue}) { ${validationMessageProperty} = 'Must be at most ${p.maxValue}'; }
            `;
        }
        return code;
    }
    let code = `
    ${validationMessageProperty} = '';
    `;
    if (p.minLength !== undefined) {
        code += `if (e.value.length < ${p.minLength}) { ${validationMessageProperty} = 'Must be at least ${p.minLength} characters'; }
        `;
    }
    if (p.maxLength !== undefined) {
        code += `if (e.value.length > ${p.maxLength}) { ${validationMessageProperty} = 'Must be at most ${p.maxLength} characters'; }
        `;
    }
    return code;
}

function parseParameters(manifest: BundleManifest): ParameterDefinitionMapping[] {
    const parameters = manifest.parameters;
    const defs: ParameterDefinitionMapping[] = [];
    if (parameters) {
        for (const k in parameters) {
            defs.push({ name: k, ...parameters[k] });
        }
    }
    return defs;
}
