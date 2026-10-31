package org.volentify.mesh.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.volentify.mesh.data.EventType
import org.volentify.mesh.data.Priority
import org.volentify.mesh.ui.theme.Palette

private val PEOPLE_TYPES = setOf(EventType.PERSON_TRAPPED, EventType.PERSON_MISSING, EventType.PERSON_RESCUED, EventType.MEDICAL_EMERGENCY)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReportScreen(vm: MeshViewModel, onClose: () -> Unit) {
    var type by remember { mutableStateOf(EventType.PERSON_TRAPPED) }
    var priority by remember { mutableStateOf(Priority.HIGH) }
    var count by remember { mutableStateOf("") }
    var needs by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    val incidents = remember { vm.incidents() }
    var incident by remember { mutableStateOf(incidents.firstOrNull()?.id) }
    var saving by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row {
            Text("New field report", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
            TextButton(onClick = onClose) { Text("Cancel", color = Palette.Sand) }
        }
        Text("Saved on this phone first. Works with no signal.", style = MaterialTheme.typography.bodySmall)

        Label("What is happening")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EventType.entries.forEach { t -> Chip(t.label, t == type, Palette.Signal) { type = t } }
        }

        Label("Priority")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Priority.entries.reversed().forEach { p ->
                Chip(p.name.lowercase().replaceFirstChar { it.uppercase() }, p == priority, priorityColor(p)) { priority = p }
            }
        }

        if (type in PEOPLE_TYPES) {
            Field("Number of people", count, KeyboardType.Number) { v -> count = v.filter { it.isDigit() }.take(4) }
        }
        Field("Needs (boats, insulin, water…)", needs) { needs = it.take(200) }
        Field("Notes", notes, minLines = 3) { notes = it.take(1000) }

        if (incidents.isNotEmpty()) {
            Label("Incident")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Chip("Not sure", incident == null, Palette.Sand) { incident = null }
                incidents.forEach { i -> Chip(i.title, incident == i.id, Palette.Gold) { incident = i.id } }
            }
        }

        Button(
            onClick = {
                saving = true
                val details = buildMap<String, Any> {
                    count.toIntOrNull()?.let { put("count", it) }
                    if (needs.isNotBlank()) put("needs", needs.split(',').map { it.trim() }.filter { it.isNotEmpty() })
                    if (notes.isNotBlank()) put("notes", notes.trim())
                }
                vm.createReport(type, priority, details, incident) { onClose() }
            },
            enabled = !saving,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(50),
            colors = ButtonDefaults.buttonColors(containerColor = Palette.Signal, contentColor = Palette.Ink),
        ) { Text(if (saving) "Saving…" else "Save report", fontSize = 16.sp) }
    }
}

@Composable
private fun Label(text: String) = Text(text, style = MaterialTheme.typography.titleMedium)

@Composable
private fun Chip(text: String, selected: Boolean, color: Color, onClick: () -> Unit) {
    Text(
        text,
        color = if (selected) Palette.Ivory else Palette.Sand,
        fontSize = 13.sp,
        modifier = Modifier
            .border(1.dp, if (selected) color else Palette.Line, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
private fun Field(label: String, value: String, keyboard: KeyboardType = KeyboardType.Text, minLines: Int = 1, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, minLines = minLines,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Palette.Signal, unfocusedBorderColor = Palette.Line,
            focusedTextColor = Palette.Ivory, unfocusedTextColor = Palette.Ivory, cursorColor = Palette.Signal,
            focusedLabelColor = Palette.Signal, unfocusedLabelColor = Palette.Stone,
        ),
    )
}
