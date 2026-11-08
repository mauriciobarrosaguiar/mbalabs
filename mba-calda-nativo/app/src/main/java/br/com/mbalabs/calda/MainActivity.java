package br.com.mbalabs.calda;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.Locale;

/** MBA Calda: native Android views, offline and without WebView or network permissions. */
public class MainActivity extends Activity {
    private static final int BG = 0xFFF7FBF5;
    private static final int DARK = 0xFF05391E;
    private static final int TEXT = 0xFF162B1C;
    private static final int LIGHT_GREEN = 0xFFEAF7DE;
    private static final int PANEL = 0xFFFFFFFF;
    private static final int INPUT = 0xFFFFFFFF;
    private static final int LIME = 0xFF78CF29;
    private static final int CYAN = 0xFF18A758;
    private static final int WHITE = 0xFFF4F8F1;
    private static final int MUTED = 0xFF526B58;
    private static final int BORDER = 0xFFC9DFC3;
    private static final String[] UNITS = {"mL/ha", "L/ha", "g/ha", "kg/ha"};
    private final DecimalFormat fmt = new DecimalFormat("#,##0.###", new DecimalFormatSymbols(new Locale("pt", "BR")));
    private final ArrayList<Product> products = new ArrayList<>();
    private SharedPreferences store;
    private LinearLayout list;
    private EditText tank, rate;
    private TextView areaText, areaDetail, countText;
    private boolean restoring;

    private static class Product {
        LinearLayout card;
        TextView heading, resultLabel;
        EditText name, dose;
        Spinner unit;
    }

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(0xFFF5FAF2);
        getWindow().setNavigationBarColor(0xFFF5FAF2);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        store = getSharedPreferences("mba_calda", MODE_PRIVATE);
        buildScreen();
        restore();
        calculate();
    }

    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + .5f); }
    private LinearLayout vertical() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.VERTICAL); return x; }
    private LinearLayout horizontal() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.HORIZONTAL); return x; }
    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w < 0 ? w : dp(w), h < 0 ? h : dp(h)); }
    private LinearLayout.LayoutParams top(int gap) { LinearLayout.LayoutParams p = lp(-1,-2); p.topMargin = dp(gap); return p; }
    private GradientDrawable shape(int color, int border, float radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color); d.setCornerRadius(dp(radius));
        if(border != Color.TRANSPARENT) d.setStroke(dp(1), border);
        return d;
    }
    private GradientDrawable gradient(int a, int b, int border, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{a,b});
        d.setCornerRadius(dp(radius));
        if (border != Color.TRANSPARENT) d.setStroke(dp(1),border);
        return d;
    }
    private TextView text(String s, float sp, int color, boolean bold, boolean mono) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setIncludeFontPadding(true);
        t.setTypeface(Typeface.create(mono?"monospace":"sans-serif-condensed", bold?Typeface.BOLD:Typeface.NORMAL));
        if (mono) t.setLetterSpacing(.15f);
        return t;
    }
    private TextView caps(String s, int sp, int color) {
        TextView t = text(s,sp,color,false,true); t.setLetterSpacing(.23f); return t;
    }
    private void section(LinearLayout page, String index, String title) {
        LinearLayout bar=horizontal(); bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView number=text(index,21,Color.WHITE,true,false);
        number.setGravity(Gravity.CENTER);
        number.setBackground(gradient(0xFF52BA15,0xFF0E852C,Color.TRANSPARENT,50));
        bar.addView(number,lp(52,52));
        TextView heading=text(title,18,DARK,true,false);
        heading.setLetterSpacing(.015f);heading.setLineSpacing(0,1.03f);
        LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(0,-2,1);
        hp.leftMargin=dp(13);bar.addView(heading,hp);
        page.addView(bar,top(24));
    }
    
    private EditText edit(String hint, boolean numeric) {
        EditText e=new EditText(this);
        e.setSingleLine(true);e.setTextColor(TEXT);e.setHintTextColor(0xFF83958B);
        e.setTextSize(17);e.setHint(hint);
        e.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
        e.setPadding(dp(13),0,dp(12),0);
        e.setBackground(shape(INPUT,BORDER,12));
        if(numeric)e.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        else e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        return e;
    }
    
    private EditText inputWithSuffix(LinearLayout parent,String hint,String suffix) {
        LinearLayout row=horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        EditText field=new EditText(this);
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        field.setBackgroundColor(Color.TRANSPARENT);
        field.setTextSize(27);field.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));
        field.setTextColor(TEXT);field.setHintTextColor(0xFF8F9E95);field.setHint(hint);
        field.setPadding(0,0,0,0);
        row.addView(field,new LinearLayout.LayoutParams(0,dp(53),1));
        TextView unit=text(suffix,15,DARK,true,false);row.addView(unit);
        parent.addView(row,top(3));watch(field);
        return field;
    }
    
    private LinearLayout metric(String title,String hint,String unit) {
        LinearLayout card=vertical();
        card.setBackground(shape(PANEL,BORDER,16));
        card.setPadding(dp(12),dp(12),dp(11),dp(10));
        TextView tag=text(title,12,DARK,true,false);
        tag.setMaxLines(2);card.addView(tag);return card;
    }
    private void explanation(LinearLayout page,String content) {
        LinearLayout card=vertical();card.setPadding(dp(14),dp(13),dp(14),dp(13));
        card.setBackground(shape(0xFFEAF6E2,0xFFD4E9CB,13));
        TextView t=text(content,14,DARK,false,false);
        t.setLineSpacing(dp(3),1f);card.addView(t);
        page.addView(card,top(12));
    }
    private void prepLine(LinearLayout parent,String number,String title,String detail){
        LinearLayout line=horizontal();line.setGravity(Gravity.TOP);
        TextView mark=text(number,16,Color.WHITE,true,false);
        mark.setGravity(Gravity.CENTER);mark.setBackground(shape(0xFF168436,Color.TRANSPARENT,50));
        line.addView(mark,lp(33,33));
        LinearLayout content=vertical();
        TextView a=text(title,15,DARK,true,false);
        TextView b=text(detail,13,MUTED,false,false);b.setLineSpacing(dp(2),1f);
        content.addView(a);content.addView(b,top(3));
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,-2,1);cp.leftMargin=dp(12);line.addView(content,cp);
        parent.addView(line,top(13));
    }
    
    private void buildScreen() {
        ScrollView scroll=new ScrollView(this);
        scroll.setFillViewport(true);scroll.setClipToPadding(false);
        scroll.setBackground(new GridDrawable());
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout page=vertical();page.setPadding(dp(16),dp(17),dp(16),dp(38));
        scroll.addView(page,new ScrollView.LayoutParams(-1,-2));

        LinearLayout hero=vertical();hero.setPadding(dp(19),dp(19),dp(19),dp(20));
        hero.setBackground(gradient(0xFF003B1D,0xFF006027,Color.TRANSPARENT,20));
        TextView brand=text("MBA CALDA  •  DRONES AGRÍCOLAS",12,0xFFB5EA7D,true,false);
        brand.setLetterSpacing(.045f);hero.addView(brand);
        TextView title=text("CÁLCULO DE CALDA",28,Color.WHITE,true,false);
        hero.addView(title,top(9));
        TextView subtitle=text("JEITO SIMPLES PARA QUEM ESTÁ COMEÇANDO",12,0xFFDEEDD9,true,false);
        subtitle.setLetterSpacing(.018f);hero.addView(subtitle,top(3));
        page.addView(hero);

        LinearLayout objective=vertical();objective.setPadding(dp(15),dp(12),dp(15),dp(12));
        objective.setBackground(shape(LIGHT_GREEN,0xFFC7E8BA,14));
        TextView goal=text("OBJETIVO",11,0xFF17692F,true,false);objective.addView(goal);
        objective.addView(text("Saber quantos hectares o tanque faz e quanto de cada produto usar.",14,TEXT,false,false),top(3));
        page.addView(objective,top(12));

        section(page,"1","DESCUBRA QUANTOS HECTARES O TANQUE FAZ");
        LinearLayout fields=horizontal();
        LinearLayout tankCard=metric("CAPACIDADE DO TANQUE","40","L");
        LinearLayout rateCard=metric("TAXA DE APLICAÇÃO","10","L/ha");
        tank=inputWithSuffix(tankCard,"40","L");
        rate=inputWithSuffix(rateCard,"10","L/ha");
        fields.addView(tankCard,new LinearLayout.LayoutParams(0,dp(102),1));
        LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,dp(102),1);
        right.leftMargin=dp(9);fields.addView(rateCard,right);
        page.addView(fields,top(12));
        explanation(page,"HECTARES = capacidade do tanque (L) ÷ taxa de aplicação (L/ha)");

        LinearLayout area=vertical();area.setPadding(dp(16),dp(14),dp(16),dp(15));
        area.setBackground(shape(0xFFDDF4CF,0xFFB8DBA9,16));
        area.addView(text("RESULTADO • ÁREA POR TANQUE",12,0xFF17652D,true,false));
        LinearLayout areaRow=horizontal();areaRow.setGravity(Gravity.CENTER_VERTICAL);
        areaText=text("— ha",35,0xFF06672C,true,false);
        areaRow.addView(areaText,new LinearLayout.LayoutParams(0,dp(59),1));
        CropIcon crop=new CropIcon(this);areaRow.addView(crop,lp(62,54));
        area.addView(areaRow,top(2));
        areaDetail=text("Informe tanque e taxa maiores que zero.",13,DARK,false,false);
        area.addView(areaDetail);
        page.addView(area,top(12));

        section(page,"2","CALCULE QUANTO DE CADA PRODUTO VAI NO TANQUE");
        explanation(page,"QUANTIDADE DO PRODUTO = hectares do passo 1 × dose do produto por hectare.");
        list=vertical();page.addView(list,top(12));
        TextView add=text("+ ADICIONAR PRODUTO",15,DARK,true,false);
        add.setGravity(Gravity.CENTER);
        add.setBackground(shape(0xFFF2FBEA,0xFF7CB85C,13));
        add.setOnClickListener(v->{addProduct("","",0);calculate();});
        page.addView(add,top(11));add.getLayoutParams().height=dp(52);
        countText=text("0/1 PRODUTOS CALCULADOS",12,MUTED,true,false);
        countText.setGravity(Gravity.CENTER);page.addView(countText,top(12));

        section(page,"3","PREPARE A CALDA");
        LinearLayout prep=vertical();prep.setPadding(dp(16),dp(5),dp(16),dp(18));
        prep.setBackground(shape(Color.WHITE,BORDER,17));
        prepLine(prep,"1","Confira as recomendações","Verifique bula, receita agronômica e compatibilidade dos produtos.");
        prepLine(prep,"2","Adicione os produtos","Respeite a ordem e as condições de mistura recomendadas.");
        prepLine(prep,"3","Complete com água","Ajuste a mistura até o volume FINAL do tanque, não acrescente um tanque extra de água.");
        prepLine(prep,"4","Agite conforme a orientação","Mantenha a agitação indicada antes e durante a aplicação.");
        page.addView(prep,top(12));

        LinearLayout rule=vertical();rule.setPadding(dp(15),dp(14),dp(15),dp(14));
        rule.setBackground(gradient(0xFF00602B,0xFF078D39,Color.TRANSPARENT,15));
        rule.addView(text("REGRA FÁCIL",14,0xFFDCFFC6,true,false));
        rule.addView(text("Tanque ÷ L/ha = hectares",16,Color.WHITE,true,false),top(5));
        rule.addView(text("Hectares × dose/ha = produto no tanque",15,Color.WHITE,true,false),top(2));
        page.addView(rule,top(17));

        TextView copy=text("COPIAR RESUMO DA CALDA",17,Color.WHITE,true,false);
        copy.setGravity(Gravity.CENTER);copy.setBackground(gradient(0xFF11782E,0xFF4AAE20,Color.TRANSPARENT,15));
        copy.setOnClickListener(v->copySummary());page.addView(copy,top(16));
        copy.getLayoutParams().height=dp(58);
        TextView clear=text("LIMPAR TODOS OS CAMPOS",13,MUTED,true,false);
        clear.setGravity(Gravity.CENTER);clear.setOnClickListener(v->confirmClear());
        page.addView(clear,top(8));clear.getLayoutParams().height=dp(42);

        LinearLayout alert=vertical();alert.setPadding(dp(13),dp(12),dp(13),dp(13));
        alert.setBackground(shape(0xFFFFF9E7,0xFFF2D99C,13));
        TextView note=text("⚠ IMPORTANTE: as quantidades calculadas não substituem a bula nem a orientação de profissional habilitado. O tanque indica o volume FINAL da calda. Use EPI.",13,0xFF624B15,false,false);
        note.setLineSpacing(dp(3),1f);alert.addView(note);
        page.addView(alert,top(15));

        setContentView(scroll);
    }
    
    private void addProduct(String name,String dose,int selected) {
        Product p=new Product();
        LinearLayout card=vertical(); card.setPadding(dp(16),dp(15),dp(16),dp(16));
        card.setBackground(shape(0xFFFFFFFF,BORDER,16)); p.card=card;
        LinearLayout top=horizontal(); top.setGravity(Gravity.CENTER_VERTICAL);
        p.heading=text("PRODUTO 01",15,DARK,true,false);
        top.addView(p.heading,new LinearLayout.LayoutParams(0,dp(40),1));
        TrashIcon trash = new TrashIcon(this);
        trash.setContentDescription("Remover produto");
        trash.setOnClickListener(v->{
            products.remove(p); list.removeView(p.card);
            if(products.isEmpty()) addProduct("","",0);
            reindex(); calculate();
        });
        top.addView(trash,lp(43,41)); card.addView(top);

        p.name=edit("Nome do produto",false); p.name.setText(name);
        card.addView(p.name,top(5)); p.name.getLayoutParams().height=dp(54);

        LinearLayout row=horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        p.dose=edit("Dose ex.: 250",true); p.dose.setText(dose);
        row.addView(p.dose,new LinearLayout.LayoutParams(0,dp(54),1));

        p.unit=new Spinner(this);
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,UNITS){
            @Override public View getView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),false); }
            @Override public View getDropDownView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),true); }
        };
        p.unit.setAdapter(adapter);
        p.unit.setBackground(shape(INPUT,BORDER,11));
        p.unit.setSelection(Math.min(UNITS.length-1,Math.max(0,selected)));
        LinearLayout.LayoutParams up = lp(101,54); up.leftMargin=dp(8);
        row.addView(p.unit,up); card.addView(row,top(11));

        LinearLayout output=horizontal();output.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable line=shape(0xFFEAF7E4,0xFFCBE8C0,12);
        output.setBackground(line);
        output.setPadding(dp(13),dp(11),dp(12),dp(11));
        TextView label=text("QUANTO USAR",12,DARK,true,false);
        output.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        p.resultLabel=text("aguardando dados",13,MUTED,true,false);
        p.resultLabel.setGravity(Gravity.END); p.resultLabel.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_END);
        output.addView(p.resultLabel,new LinearLayout.LayoutParams(0,-2,1.32f));
        card.addView(output,top(11));

        products.add(p);list.addView(card,top(products.size()==1?0:12));
        reindex();watch(p.name);watch(p.dose);
        p.unit.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(AdapterView<?> a,View v,int pos,long id){calculate();}
            @Override public void onNothingSelected(AdapterView<?> a){}
        });
    }
    private TextView unitText(String title,boolean drop) {
        TextView t=text(title,15,TEXT,false,false);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(13),dp(8),dp(4),dp(8));
        t.setMinHeight(dp(drop?48:50));
        if(drop) t.setBackgroundColor(0xFFE9F5E5);
        return t;
    }
    private void reindex(){for(int i=0;i<products.size();i++)products.get(i).heading.setText(String.format(Locale.US,"PRODUTO %02d",i+1));}
    private void watch(EditText e){e.addTextChangedListener(new TextWatcher(){
        @Override public void beforeTextChanged(CharSequence s,int start,int count,int after){}
        @Override public void onTextChanged(CharSequence s,int start,int before,int count){calculate();}
        @Override public void afterTextChanged(Editable e){}
    });}
    private Double positive(String text){
        try {
            String s=text.trim().replace(" ","");
            if(s.contains(",")) s=s.replace(".","").replace(',','.');
            double x=Double.parseDouble(s);
            return Double.isFinite(x)&&x>0 ? x : null;
        }catch(Exception e){return null;}
    }
    private Double hectares(){
        if(tank==null||rate==null)return null;
        Double t=positive(tank.getText().toString()); Double r=positive(rate.getText().toString());
        return t==null||r==null?null:t/r;
    }
    private String quantity(double amount,int unit){
        boolean volume=unit<2;
        double base=(unit==0||unit==2)?amount:amount*1000;
        if(base>=1000)return fmt.format(base/1000)+(volume?" L":" kg");
        return fmt.format(base)+(volume?" mL":" g");
    }
    private void calculate(){
        if(areaText==null||countText==null)return;
        Double h=hectares();
        if(h==null){
            areaText.setText("— ha");areaDetail.setText("Informe tanque e taxa maiores que zero.");
        }else{
            SpannableString v=new SpannableString(fmt.format(h)+" ha");
            v.setSpan(new ForegroundColorSpan(MUTED),fmt.format(h).length(),v.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            areaText.setText(v);
            areaDetail.setText(fmt.format(positive(tank.getText().toString()))+" L ÷ "+fmt.format(positive(rate.getText().toString()))+" L/ha = "+fmt.format(h)+" hectares");
        }
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(h==null||d==null){p.resultLabel.setText("aguardando dados");p.resultLabel.setTextColor(MUTED);}
            else {int u=p.unit.getSelectedItemPosition();if(u<0)u=0;
                p.resultLabel.setText(quantity(h*d,u));p.resultLabel.setTextColor(0xFF087A35);complete++;}
        }
        countText.setText(complete+"/"+products.size()+" PRODUTOS CALCULADOS");
        if(!restoring)save();
    }
    private void save(){
        try{
            JSONObject root=new JSONObject();
            root.put("tank",tank.getText().toString());root.put("rate",rate.getText().toString());
            JSONArray arr=new JSONArray();
            for(Product p:products){JSONObject o=new JSONObject();o.put("name",p.name.getText().toString());o.put("dose",p.dose.getText().toString());o.put("unit",p.unit.getSelectedItemPosition());arr.put(o);}
            root.put("products",arr);
            store.edit().putString("state",root.toString()).apply();
        }catch(Exception ignored){}
    }
    private void restore(){
        restoring=true;
        try{
            JSONObject root=new JSONObject(store.getString("state","{}"));
            tank.setText(root.optString("tank",""));rate.setText(root.optString("rate",""));
            JSONArray arr=root.optJSONArray("products");
            if(arr!=null)for(int i=0;i<arr.length();i++){
                JSONObject o=arr.optJSONObject(i);if(o!=null)addProduct(o.optString("name",""),o.optString("dose",""),o.optInt("unit",0));
            }
        }catch(Exception ignored){}
        if(products.isEmpty())addProduct("","",0);
        restoring=false;
    }
    private void copySummary(){
        Double h=hectares();if(h==null){Toast.makeText(this,"Informe tanque e taxa primeiro.",Toast.LENGTH_SHORT).show();return;}
        StringBuilder s=new StringBuilder("MBA CALDA — RESUMO\n");
        s.append("Tanque: ").append(tank.getText()).append(" L\nTaxa: ").append(rate.getText()).append(" L/ha\n");
        s.append("Área por tanque: ").append(fmt.format(h)).append(" ha\n\nPRODUTOS POR TANQUE:\n");
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(d==null)continue;
            int u=Math.max(0,p.unit.getSelectedItemPosition());
            String name=p.name.getText().toString().trim();if(name.isEmpty())name="Produto "+(complete+1);
            s.append("• ").append(name).append(": ").append(quantity(h*d,u)).append(" (dose ").append(fmt.format(d)).append(" ").append(UNITS[u]).append(")\n");complete++;
        }
        if(complete==0){Toast.makeText(this,"Informe ao menos uma dose de produto.",Toast.LENGTH_SHORT).show();return;}
        s.append("\nComplete com água até o volume FINAL do tanque. Confira a bula e a compatibilidade da mistura.");
        ClipboardManager clipboard=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        if(clipboard!=null)clipboard.setPrimaryClip(ClipData.newPlainText("Resumo MBA Calda",s.toString()));
        Toast.makeText(this,"Resumo copiado!",Toast.LENGTH_SHORT).show();
    }
    private void confirmClear(){
        new AlertDialog.Builder(this).setTitle("Limpar cálculo?")
            .setMessage("Apagar os valores e todos os produtos adicionados?")
            .setNegativeButton("Cancelar",null).setPositiveButton("Limpar",(d,w)->{
                restoring=true;tank.setText("");rate.setText("");products.clear();list.removeAllViews();
                addProduct("","",0);restoring=false;calculate();
                Toast.makeText(this,"Campos limpos",Toast.LENGTH_SHORT).show();
            }).show();
    }

    /** Faint engineering grid and diffuse lime-green ambient bloom. */
    private class GridDrawable extends Drawable {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas c){
            Rect bounds=getBounds();
            p.setShader(new LinearGradient(0,0,0,bounds.height(),
                0xFFF8FCF7,0xFFEAF5E7,Shader.TileMode.CLAMP));
            c.drawRect(bounds,p);p.setShader(null);
        }
        @Override public void setAlpha(int a){}
        @Override public void setColorFilter(android.graphics.ColorFilter f){}
        @Override public int getOpacity(){return PixelFormat.OPAQUE;}
    }
    
    private class CropIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        CropIcon(Context c){super(c);} 
        @Override protected void onDraw(Canvas raw){super.onDraw(raw);
            Canvas c=raw;int save=c.save();c.scale(getWidth()/70f,getHeight()/60f);
            p.setColor(0xFF137B36);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2.1f);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(35,29,35,9,p);
            Path leaf=new Path();leaf.moveTo(35,22);leaf.cubicTo(16,20,18,5,21,5);leaf.cubicTo(37,6,35,20,35,22);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(35,21);leaf.cubicTo(48,3,58,9,57,12);leaf.cubicTo(57,21,42,23,35,21);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(8,35);leaf.quadTo(35,26,63,35);c.drawPath(leaf,p);
            for(int i=0;i<3;i++){leaf.reset();leaf.moveTo(7+i*3,42+i*8);leaf.quadTo(35,32+i*7,63-i*3,42+i*8);c.drawPath(leaf,p);}
            c.restoreToCount(save);
        }
    }
    private class TrashIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        TrashIcon(Context c){super(c);setBackground(shape(0xFFEAF7E4,Color.TRANSPARENT,8));}
        @Override protected void onDraw(Canvas c){super.onDraw(c);
            float mid=getWidth()/2f,top=getHeight()/2f;
            p.setColor(DARK);p.setStrokeWidth(dp(1.7f));p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(mid-dp(9),top-dp(8),mid+dp(9),top-dp(8),p);
            c.drawLine(mid-dp(4),top-dp(11),mid+dp(4),top-dp(11),p);
            c.drawRoundRect(mid-dp(7),top-dp(5),mid+dp(7),top+dp(11),dp(2),dp(2),p);
            c.drawLine(mid-dp(2.5f),top-dp(2),mid-dp(2.5f),top+dp(7),p);
            c.drawLine(mid+dp(2.5f),top-dp(2),mid+dp(2.5f),top+dp(7),p);
        }
    }
}