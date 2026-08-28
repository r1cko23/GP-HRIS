-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
create PROCEDURE [dbo].[payrollsummaryprocessold]
	 @idclient INT,
     @uname NVARCHAR(20),
	 @datestart NVARCHAR(20),
	 @Guid VarChar(100)
	 		
AS	
BEGIN

DECLARE 
	@count int
	
	 DECLARE @sqldelpayrollsummary2 NVARCHAR(MAX)

    SET @sqldelpayrollsummary2 = N'DELETE FROM payroll_summary2 WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + N' AND uname = ''' + @uname + N''''

    EXEC (@sqldelpayrollsummary2)

	DECLARE @employeename NVARCHAR(MAX)
    SET @employeename = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
   SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, Date_Start, Date_End, payrolldate, payrollpaytype, 0 AS Headersort, N''Employee Name'' AS Headername, ''' + @uname + N''' AS uname
   FROM payroll_summary
   WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + '''' 
   
   EXEC (@employeename)

--'append daily rate
	DECLARE @dailyrate NVARCHAR(MAX)
    SET @dailyrate = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,dailyrate_payroll, Date_Start, Date_End, payrolldate, payrollpaytype, 1 AS Headersort, N''Daily Rate'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@dailyrate)


	--'append hours
	DECLARE @hours NVARCHAR(MAX)
    SET @hours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,noofhourswork, Date_Start, Date_End, payrolldate, payrollpaytype, 3 AS Headersort, N''Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@hours)

	--'append days
	DECLARE @days NVARCHAR(MAX)
    SET @days = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, noofdayswork, Date_Start, Date_End, payrolldate, payrollpaytype, 4 AS Headersort, N''Days'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@days)

	--'append basic

	DECLARE @basic NVARCHAR(MAX)
	
    SET @basic = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, basic, Date_Start, Date_End, payrolldate, payrollpaytype, 5 AS Headersort, N''Basic'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@basic)
		

 --'append total salary
	DECLARE @totalsalary NVARCHAR(MAX)
    SET @totalsalary = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(totalsalary AS DECIMAL(10,2)) as totalsalary, Date_Start, Date_End, payrolldate, payrollpaytype, 7 AS Headersort, N''Total Salary'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@totalsalary)

	--'append regular overtime hours
	DECLARE @regothours NVARCHAR(MAX)
    SET @regothours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, overtime_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 8 AS Headersort, N''Reg OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@regothours)

	--'append regular overtime amount
	DECLARE @regothamount NVARCHAR(MAX)
    SET @regothamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(overtime AS DECIMAL(10,2)) AS overtime, Date_Start, Date_End, payrolldate, payrollpaytype, 9 AS Headersort, N''Reg OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@regothamount)

	--'append OT night diff hours 
	DECLARE @otnightdiffhours  NVARCHAR(MAX)
    SET @otnightdiffhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,nightdiff_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 10 AS Headersort, N''OT NightDiff Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@otnightdiffhours)

	--'append OT night diff amount
	DECLARE @otnightdiffamount  NVARCHAR(MAX)
    SET @otnightdiffamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(nightdiff AS DECIMAL(10,2)) AS nightdiff, Date_Start, Date_End, payrolldate, payrollpaytype, 11 AS Headersort, N''OT NightDiff Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@otnightdiffamount)

	--'append Regular night diff OT hours 
	DECLARE @regularnightshiftOT_hours  NVARCHAR(MAX)
    SET @regularnightshiftOT_hours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,regularnightshiftOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 11.1 AS Headersort, N''Reg Nightdiff OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@regularnightshiftOT_hours)


	--'append Regular night diff amount 
	DECLARE @regularnightshiftamount  NVARCHAR(MAX)
    SET @regularnightshiftamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(regularnightshiftOT AS DECIMAL(10,2))  AS regularnightshiftOT , Date_Start, Date_End, payrolldate, payrollpaytype, 11.2 AS Headersort, N''Reg Nightdiff OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@regularnightshiftamount)

	--'append Legal No Work Hours
	DECLARE @legalnoworkhours  NVARCHAR(MAX)
    SET @legalnoworkhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnoworkhours, Date_Start, Date_End, payrolldate, payrollpaytype, 11.3 AS Headersort, N''Legal No Work Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalnoworkhours)

	--'append Legal No Work amount
	DECLARE @legalnoworkamount  NVARCHAR(MAX)
    SET @legalnoworkamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnowork, Date_Start, Date_End, payrolldate, payrollpaytype, 11.4 AS Headersort, N''Legal No Work Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalnoworkamount)

	--'append Legal holiday hours
	DECLARE @legalholidayhours  NVARCHAR(MAX)
    SET @legalholidayhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 12 AS Headersort, N''Legal Holiday Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayhours)

	--'append Legal holiday amt
	DECLARE @legalholidayamount  NVARCHAR(MAX)
    SET @legalholidayamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholiday, Date_Start, Date_End, payrolldate, payrollpaytype, 13 AS Headersort, N''Legal Holiday Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayamount)

	--'append Legal holiday OT HOURS
	DECLARE @legalholidayothours  NVARCHAR(MAX)
    SET @legalholidayothours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholidayOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 14 AS Headersort, N''Legal Holiday OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayothours)

	--'append Legal holiday OT amt
	DECLARE @legalholidayotamount  NVARCHAR(MAX)
    SET @legalholidayotamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(legalholidayOT AS DECIMAL(10,2)) AS legalholidayOT, Date_Start, Date_End, payrolldate, payrollpaytype, 15 AS Headersort, N''Legal Holiday OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayotamount)

	--'append Legal holiday nightdiff hours
	DECLARE @legalholidayndhours  NVARCHAR(MAX)
    SET @legalholidayndhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalholidayND_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 16 AS Headersort, N''Legal Holiday ND Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayndhours)

	--'append Legal holiday nightdiff amount
	DECLARE @legalholidayndamount  NVARCHAR(MAX)
    SET @legalholidayndamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(legalholidayND AS DECIMAL(10,2)) AS legalholidayND, Date_Start, Date_End, payrolldate, payrollpaytype, 17 AS Headersort, N''Legal Holiday ND Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayndamount)

	--'append Legal holiday OTND hours
	DECLARE @legalholidayOTNDhours  NVARCHAR(MAX)
    SET @legalholidayOTNDhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,lhotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 17.1 AS Headersort, N''LH OT ND Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayOTNDhours)

	--'append Legal holiday OTND amount
	DECLARE @legalholidayOTNDamount  NVARCHAR(MAX)
    SET @legalholidayOTNDamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(lhotnd AS DECIMAL(10,2)) AS lhotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 17.2 AS Headersort, N''LH OT ND Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayOTNDamount)

	--'append special holiday hours
	DECLARE @specialholidayhours  NVARCHAR(MAX)
    SET @specialholidayhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,holiday_special_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 18 AS Headersort, N''Special Holiday Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayhours)

	--'append special holiday amount
	DECLARE @specialholidayamount  NVARCHAR(MAX)
    SET @specialholidayamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(holiday_special AS DECIMAL(10,2)) AS holiday_special, Date_Start, Date_End, payrolldate, payrollpaytype, 19 AS Headersort, N''Special Holiday Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayamount)

	--'append special holiday OT Hours
	DECLARE @specialholidayOThours  NVARCHAR(MAX)
    SET @specialholidayOThours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,holiday_specialOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 20 AS Headersort, N''Special Holiday OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayOThours)

	--'append special holiday OT Amount
	DECLARE @specialholidayOTamount  NVARCHAR(MAX)
    SET @specialholidayOTamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(holiday_specialOT AS DECIMAL(10,2)) AS holiday_specialOT , Date_Start, Date_End, payrolldate, payrollpaytype, 21 AS Headersort, N''Special Holiday OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayOTamount)

	--'append special holiday ND hours
	DECLARE @specialholidayNDhours  NVARCHAR(MAX)
    SET @specialholidayNDhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,SHnightdiffOT_hours, Date_Start, Date_End, payrolldate, payrollpaytype, 22 AS Headersort, N''Special Holiday ND Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayNDhours)

	--'append special holiday ND amount
	DECLARE @specialholidayNDamount  NVARCHAR(MAX)
    SET @specialholidayNDamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(Holiday_Specialnightdiff AS DECIMAL(10,2)) AS holiday_specialnightdiff, Date_Start, Date_End, payrolldate, payrollpaytype, 23 AS Headersort, N''Special Holiday ND Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayNDamount)

	--'append special holiday OTND hours
	DECLARE @specialholidayOTNDhours  NVARCHAR(MAX)
    SET @specialholidayOTNDhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,shotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 23.1 AS Headersort, N''SH OT ND Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayOTNDhours)


	--'append special holiday OTND amount
	DECLARE @specialholidayOTNDamount  NVARCHAR(MAX)
    SET @specialholidayOTNDamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(shotnd AS DECIMAL(10,2)) AS shotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 23.2 AS Headersort, N''SH OT ND Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayOTNDamount)


	--'append special holiday RDOT Hours
	DECLARE @specialholidayRDOThours  NVARCHAR(MAX)
    SET @specialholidayRDOThours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,SHONRDOThours, Date_Start, Date_End, payrolldate, payrollpaytype, 24 AS Headersort, N''SH Restday OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayRDOThours)

	--'append special holiday RDOT amount
	DECLARE @specialholidayRDOTamount  NVARCHAR(MAX)
    SET @specialholidayRDOTamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(SHONRDOT AS DECIMAL(10,2)) AS SHONRDOT, Date_Start, Date_End, payrolldate, payrollpaytype, 25 AS Headersort, N''SH Restday OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@specialholidayRDOTamount)


	--'append legal holiday RDOT Hours
	DECLARE @legalholidayRDOThours  NVARCHAR(MAX)
    SET @legalholidayRDOThours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,LHONRDOThours, Date_Start, Date_End, payrolldate, payrollpaytype, 25.1 AS Headersort, N''LH Restday OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayRDOThours)

	--'append legal holiday RDOT amount
	DECLARE @legalholidayRDOTamount  NVARCHAR(MAX)
    SET @legalholidayRDOTamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(LHONRDOT AS DECIMAL(10,2)) AS LHONRDOT, Date_Start, Date_End, payrolldate, payrollpaytype, 25.2 AS Headersort, N''LH Restday OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@legalholidayRDOTamount)

	--'append RD Hours
	DECLARE @RDhours  NVARCHAR(MAX)
    SET @RDhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,rdhours, Date_Start, Date_End, payrolldate, payrollpaytype, 26 AS Headersort, N''Restday OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@RDhours)

	--'append RD amount
	DECLARE @RDamount  NVARCHAR(MAX)
    SET @RDamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,RD, Date_Start, Date_End, payrolldate, payrollpaytype, 26.1 AS Headersort, N''Restday OT amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@RDamount)

	--'append WDO Hours
	DECLARE @WDOhours  NVARCHAR(MAX)
    SET @WDOhours = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wdohours, Date_Start, Date_End, payrolldate, payrollpaytype, 28 AS Headersort, N''WDO OT Hours'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@WDOhours)

	--'append WDO amount
	DECLARE @WDOamount  NVARCHAR(MAX)
    SET @WDOamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wdo, Date_Start, Date_End, payrolldate, payrollpaytype, 29 AS Headersort, N''WDO OT Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@WDOamount)

	--'append Total OT
	DECLARE @TotalOT  NVARCHAR(MAX)
    SET @TotalOT = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,totalOT, Date_Start, Date_End, payrolldate, payrollpaytype, 40 AS Headersort, N''Total OT'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@TotalOT)

   --'append Total ND
	DECLARE @TotalND  NVARCHAR(MAX)
    SET @TotalND = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,nightdifftotal, Date_Start, Date_End, payrolldate, payrollpaytype, 40.1 AS Headersort, N''Total Night Diff'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@TotalND)

	--'append Gross Salary
	DECLARE @gross  NVARCHAR(MAX)
    SET @gross = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(grossalary AS DECIMAL(10,2)) as grossalary, Date_Start, Date_End, payrolldate, payrollpaytype, 200 AS Headersort, N''Gross Amt'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@gross)


	--'append SSS
	DECLARE @sss  NVARCHAR(MAX)
    SET @sss = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(contributionsssee AS DECIMAL(10,2)) as contributionsssee, Date_Start, Date_End, payrolldate, payrollpaytype, 201 AS Headersort, N''SSS'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@sss)

	--'append philhealth
	DECLARE @philhealth  NVARCHAR(MAX)
    SET @philhealth = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(contributionphilhealthee AS DECIMAL(10,2)) as contributionphilhealthee , Date_Start, Date_End, payrolldate, payrollpaytype, 203 AS Headersort, N''PHILHEALTH'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@philhealth)

	--'append pagibig
	DECLARE @pagibig  NVARCHAR(MAX)
    SET @pagibig = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,contributionpagibigee, Date_Start, Date_End, payrolldate, payrollpaytype, 204 AS Headersort, N''PagIbig'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@pagibig)

	--'append wtax
	DECLARE @wtax  NVARCHAR(MAX)
    SET @wtax = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wtax, Date_Start, Date_End, payrolldate, payrollpaytype, 205 AS Headersort, N''Withholding Tax'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@wtax)

	
	--'append total deduction
	DECLARE @totaldedection  NVARCHAR(MAX)
    SET @totaldedection = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(totaldeduction AS DECIMAL(10,2)) as totaldeduction, Date_Start, Date_End, payrolldate, payrollpaytype, 9999 AS Headersort, N''Total Deduction'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@totaldedection)

	--'append Netamount
	DECLARE @netamount  NVARCHAR(MAX)
    SET @netamount = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount AS DECIMAL(10,2)) as netamount, Date_Start, Date_End, payrolldate, payrollpaytype, 10000 AS Headersort, N''Net Amount'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@netamount)

	--'append Netamount2 for payslip
	DECLARE @netamount2  NVARCHAR(MAX)
    SET @netamount2 = N'INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount2 AS DECIMAL(10,2)) as netamount2, Date_Start, Date_End, payrolldate, payrollpaytype, 10000.1 AS Headersort, N''Net Amount2'' AS Headername,''' + @uname + N''' AS uname
    FROM payroll_summary
    WHERE idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	EXEC (@netamount2)

	                     

-------------------------Payro report  other dededuction Process -----------------------------------



--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17
DECLARE @idpayrollsum  int
DECLARE @employeeid  int
DECLARE @fname2 varchar(30)
DECLARE @lname2 varchar(30)
DECLARE @mname2 varchar(30)

DECLARE @idclientp2 int
DECLARE @departmentdesc2 varchar(30)
DECLARE @department_codep int
DECLARE @payrollpaytype varchar(15)
DECLARE @payrolldate varchar(20)
DECLARE @Date_Start varchar(20)
DECLARE @Date_end varchar(20)
DECLARE @codeotherdeduction float
DECLARE @particular varchar(30)
DECLARE @amount float
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

--List to be process
SELECT otherdeduction.idpayrollsum, 
                      otherdeduction.employee_id, 
                      payroll_summary.fname2,
                      payroll_summary.lname2,
                      payroll_summary.mname2, 
                      payroll_summary.idclientp, 
                      payroll_summary.departmentdesc2, 
                      payroll_summary.department_codep,
                      payroll_summary.payrollpaytype, 
                      payroll_summary.payrolldate, 
                      otherdeduction.Date_Start, 
                      otherdeduction.Date_end, 
                      otherdeduction.codeotherdeduction, 
                      otherdeduction.particular,
                      otherdeduction.amount 
                      FROM otherdeduction INNER JOIN payroll_summary ON otherdeduction.idpayrollsum = payroll_summary.idpayrollsum 
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart

	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idpayrollsum,@employeeid,@fname2,@lname2,@mname2,@idclientp2, @departmentdesc2,@department_codep,@payrollpaytype,@payrolldate,@Date_Start,@Date_end,@codeotherdeduction,@particular,@amount
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  		--update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@pidpayrollsum2

	
			INSERT INTO payroll_summary2(
			idpayrollsum
			,employee_id
			,fname
			,lname,mname
			,idclientp
			,departmentdesc2
			,department_codep
			,amount
			,date_start
			,date_end
			,payrolldate
			,payrollpaytype
			,uname
			,headersort
			,headername) 
			Values
           (@idpayrollsum
			,@employeeid
			,@fname2
			,@lname2
			,@mname2
			,@idclientp2
			,@departmentdesc2
			,@department_codep
			,@amount
			,@date_start
			,@date_end
			,@payrolldate
			,@payrollpaytype
			,@uname
			,@codeotherdeduction
			,@particular)				   

						
	FETCH NEXT FROM myCursor3 INTO  @idpayrollsum,@employeeid,@fname2,@lname2,@mname2,@idclientp2, @departmentdesc2,@department_codep,@payrollpaytype,@payrolldate,@Date_Start,@Date_end,@codeotherdeduction,@particular,@amount
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	   	  -------------------- End Other Deduction Process-----------------------------------------


		  ----------------------------------------Ajustment Processs--------------------------------------


--DECLARE @idclient int =17
--DECLARE @datestart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17
--Declare @uname varchar(10)='pat'


DECLARE @Aidpayrollsum  int
DECLARE @Aemployeeid  int
DECLARE @Afname2 varchar(30)
DECLARE @Alname2 varchar(30)
DECLARE @Amname2 varchar(30)

DECLARE @Aidclientp2 int
DECLARE @Adepartmentdesc2 varchar(30)
DECLARE @Adepartment_codep int
DECLARE @Apayrollpaytype varchar(15)
DECLARE @Apayrolldate varchar(20)
DECLARE @ADate_Start varchar(20)
DECLARE @ADate_end varchar(20)
DECLARE @Acodeadjustment float
DECLARE @Aparticular varchar(30)
DECLARE @Aamount float
 
     
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

--List to be process
SELECT adjustment.idpayrollsum, 
                      adjustment.employee_id, 
                      payroll_summary.fname2,
                      payroll_summary.lname2,
                      payroll_summary.mname2, 
                      payroll_summary.idclientp, 
                      payroll_summary.departmentdesc2, 
                      payroll_summary.department_codep,
                      payroll_summary.payrollpaytype, 
                      payroll_summary.payrolldate, 
                      adjustment.Date_Start, 
                      adjustment.Date_end, 
                      adjustment.codeadjustment, 
                      adjustment.particular,
                      adjustment.amount 
                      FROM adjustment INNER JOIN payroll_summary ON adjustment.idpayrollsum = payroll_summary.idpayrollsum 
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart

	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @Aidpayrollsum,@Aemployeeid,@Afname2,@Alname2,@Amname2,@Aidclientp2, @Adepartmentdesc2,@Adepartment_codep,@Apayrollpaytype,@Apayrolldate,@ADate_Start,@ADate_end,@Acodeadjustment,@Aparticular,@Aamount
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  		--update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@pidpayrollsum2

			INSERT INTO payroll_summary2(
			idpayrollsum
			,employee_id
			,fname
			,lname,mname
			,idclientp
			,departmentdesc2
			,department_codep
			,amount
			,date_start
			,date_end
			,payrolldate
			,payrollpaytype
			,uname
			,headersort
			,headername) 
			Values
           (@Aidpayrollsum
			,@Aemployeeid
			,@Afname2
			,@Alname2
			,@Amname2
			,@Aidclientp2
			,@Adepartmentdesc2
			,@Adepartment_codep
			,@Aamount
			,@Adate_start
			,@Adate_end
			,@Apayrolldate
			,@Apayrollpaytype
			,@uname
			,@Acodeadjustment
			,@Aparticular)				   

						
	FETCH NEXT FROM myCursor4 INTO  @Aidpayrollsum,@Aemployeeid,@Afname2,@Alname2,@Amname2,@Aidclientp2, @Adepartmentdesc2,@Adepartment_codep,@Apayrollpaytype,@Apayrolldate,@ADate_Start,@ADate_end,@Acodeadjustment,@Aparticular,@Aamount
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4





		  -----------------------------------End Adjustment Process --------------------------------------------













--DECLARE @updateadjustment  NVARCHAR(MAX)
---   SET @updateadjustment =	N'UPDATE adjustment
--	SET codeadjustment = IncomeClass.codeadjustment
--	FROM adjustment INNER JOIN IncomeClass ON adjustment.particular = IncomeClass.Income_desc
--	WHERE adjustment.idclientincome = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND adjustment.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
--EXEC (@updateadjustment)

	--Adjustment
	--DECLARE @adjustment  NVARCHAR(MAX)	
	--SET @adjustment= N'INSERT INTO payroll_summary2(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, payrollpaytype, payrolldate, date_start, date_end, Headername, Headersort, Amount)
	--				SELECT adjustment.idpayrollsum, adjustment.employee_id, payroll_summary.fname2, payroll_summary.lname2, payroll_summary.mname2, payroll_summary.idclientp, payroll_summary.departmentdesc2, payroll_summary.department_codep, payroll_summary.payrollpaytype, payroll_summary.payrolldate, adjustment.Date_Start, adjustment.Date_End, adjustment.particular, adjustment.codeadjustment, adjustment.amount
	--				FROM adjustment INNER JOIN payroll_summary ON adjustment.idpayrollsum = payroll_summary.idpayrollsum
	--				WHERE payroll_summary.idclientp = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND payroll_summary.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
	--EXEC (@adjustment)

--DECLARE @updateotherdeduction  NVARCHAR(MAX)
--    SET @updateotherdeduction =	N'UPDATE otherdeduction
--	SET codeotherdeduction = otherdeductionclass.codeotherdeduction
--	FROM otherdeduction INNER JOIN otherdeductionclass ON otherdeduction.particular = otherdeductionclass.otherdeduction_desc
--	WHERE otherdeduction.idclientdeduction = ' + CAST(@idclient AS NVARCHAR(MAX)) + ' AND otherdeduction.date_start = ''' + CONVERT(NVARCHAR, @datestart, 23) + ''''
--EXEC (@updateotherdeduction)




END 

