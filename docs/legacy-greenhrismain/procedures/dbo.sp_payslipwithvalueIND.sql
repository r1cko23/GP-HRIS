create PROCEDURE [dbo].[sp_payslipwithvalueIND]
    @idpayrollsum INT,
	@uname nvarchar(30)
   
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;

    -- 🔒 Lock rows for this user to avoid duplicate concurrent inserts
    DELETE FROM otchart WITH (HOLDLOCK)
    WHERE uname = @uname
    


    -- ✅ Insert only if not exists (double protection)
    INSERT INTO OTCHART (idpayrollsum, ottype, noofhours, amount, uname)
    SELECT 
        ps.idpayrollsum,
        v.ottype,
        v.noofhours,
        v.amount,
        @uname
    FROM payroll_summary ps
    CROSS APPLY (VALUES
        ('Basic',        ps.noofhourswork/8,           ps.basic),
        ('Overtime',     ps.Overtime_Hours,            ps.Overtime),
        ('Nighdiff',     ps.Nightdiff_Hours,           ps.Nightdiff),
        ('Nighdiff OT',  ps.regularnightshiftOT_hours, ps.regularnightshiftOT),

        ('Legal Holiday',ps.LegalHoliday_Hours,        ps.LegalHoliday),
        ('Legal HD OT',  ps.LegalHolidayOT_Hours,      ps.LegalHolidayOT),
        ('Legal HD ND',  ps.LegalHolidayND_Hours,      ps.LegalHolidayND),
        ('Legal HD NDOT',ps.lhotndh,                   ps.lhotnd),

        ('Special Holiday',ps.Holiday_Special_Hours,   ps.Holiday_Special),
        ('Special HD OT', ps.Holiday_SpecialOT_Hours,  ps.Holiday_SpecialOT),
        ('Special HD ND', ps.Holiday_SpecialND_Hours,  ps.Holiday_Specialnightdiff),
        ('Special HD NDOT',ps.shotndh,                 ps.shotnd),

        ('Rest Day',     ps.RDhours,                   ps.RD),
        ('Rest Day OT',  ps.RDothours,                 ps.RDot),
        ('Rest Day ND',  ps.rdndhours,                 ps.rdnd),
        ('Rest Day NDOT',ps.rdndothours,               ps.rdndot),

        ('LH/WDO',       ps.lhwdohours,                ps.lhwdo),
        ('LH/WDO OT',    ps.lhwdoothours,              ps.lhwdoot),
        ('LH/WDO ND',    ps.lhwdondhours,              ps.lhwdond),
        ('LH/WDO NDOT',  ps.lhwdondothours,            ps.lhwdondot),

        ('SH/WDO',       ps.shwdohours,                ps.shwdo),
        ('SH/WDO OT',    ps.shwdoothours,              ps.shwdoot),
        ('SH/WDO ND',    ps.shwdondhours,              ps.shwdond),
        ('SH/WDO NDOT',  ps.shwdondothours,            ps.shwdondot),

        ('SH ON RDOT',   ps.SHONRDOThours,             ps.SHONRDOT),
        ('LH ON RDOT',   ps.LHONRDOThours,             ps.LHONRDOT),

        ('WDO',          ps.WDOhours,                  ps.WDO),

		('Income Adjustment',    0,                    ps.incomeadjustmentp),
        ('Allowance',		   	 0,                    ps.allowancep)

    ) v(ottype, noofhours, amount)
    WHERE ps.idpayrollsum = @idpayrollsum 
      AND v.amount <> 0
      AND NOT EXISTS (
            SELECT 1 
            FROM otchart o
            WHERE o.idpayrollsum = ps.idpayrollsum
              AND o.ottype = v.ottype
              AND o.uname = @uname
      );

    COMMIT TRAN;
END