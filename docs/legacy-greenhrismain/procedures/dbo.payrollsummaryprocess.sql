-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
CREATE PROCEDURE [dbo].[payrollsummaryprocess]
	 @idclient INT,
	 @iddepartment Int, 
	 @uname NVARCHAR(20),
	 @datestart date,
	 @dateend date,

	 @guid nvarchar(100)
	 		
AS	
BEGIN

DECLARE 
	@count int
	
	--' DECLARE @sqldelpayrollsummary2 NVARCHAR(MAX)

   -- 'SET @sqldelpayrollsummary2 = N'DELETE FROM payroll_summary2 WHERE idclientp = ' + @idclient + N' AND uname = @uname'

   -- 'EXEC (@sqldelpayrollsummary2)


DELETE FROM payroll_summary2 WHERE idclientp = @idclient AND uname = @uname and guid <> @guid

--'Employee Name
-- Cache filtered rows into temp table
    SELECT *
    INTO #FilteredSummary
    FROM payroll_summary
    WHERE idclientp = @idclient 
      AND date_start = @datestart 
	  AND Date_End = @dateend 
      AND department_codep = @iddepartment;

    -- Insert all rows in one pass
    INSERT INTO payroll_summary2 (
        IDpayrollsum, employee_id, fname, lname, mname,
        idclientp, departmentdesc2, department_codep, amount,
        date_start, date_end, payrolldate, payrollpaytype,
        Headersort, Headername, uname, guid
    )
    SELECT IDpayrollsum, Employee_id, fname2, lname2, mname2,
           idclientp, departmentdesc2, department_codep, NULL,
           Date_Start, Date_End, payrolldate, payrollpaytype,
           0, 'Employee Name', @uname, @guid
    FROM #FilteredSummary

    UNION ALL	  --'append daily rate
    SELECT IDpayrollsum, Employee_id, fname2, lname2, mname2,
           idclientp, departmentdesc2, department_codep, dailyrate_payroll,
           Date_Start, Date_End, payrolldate, payrollpaytype,
           1, 'Daily Rate', @uname, @guid
    FROM #FilteredSummary

	UNION ALL    --'append hours
    SELECT 
        idpayrollsum, Employee_id, fname2, lname2, mname2,
        idclientp, departmentdesc2, department_codep,
        noofhourswork, 
        Date_Start, Date_End, payrolldate, payrollpaytype,
        3, 'Hours', @uname, @guid
    FROM #FilteredSummary

	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    noofdayswork,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    4, 'Days', @uname, @guid
	FROM #FilteredSummary

	   
	--'append basic	   
   UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    basic,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    5, 'Basic', @uname, @guid
	FROM #FilteredSummary

		

 --'append total salary
 	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(totalsalary AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    7, 'Total Salary', @uname, @guid
	FROM #FilteredSummary


	--'append regular overtime hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    overtime_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    8, 'Reg OT Hours', @uname, @guid
	FROM #FilteredSummary


	--'append regular overtime amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(overtime AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    9, 'Reg OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append OT night diff hours 
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    nightdiff_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    10, 'NightDiff Hours', @uname, @guid
	FROM #FilteredSummary
    


	--'append OT night diff amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(nightdiff AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    11, 'NightDiff Amt', @uname, @guid
	FROM #FilteredSummary


	--'append Regular night diff OT hours 
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    regularnightshiftOT_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    30, 'Reg Nightdiff OT Hours', @uname, @guid
	FROM #FilteredSummary



	--'append Regular night diff amount 

	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(regularnightshiftOT AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    30.1, 'Reg Nightdiff OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append Legal No Work Hours
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnoworkhours, Date_Start, Date_End, payrolldate, payrollpaytype, 11.3 AS Headersort, 'Legal No Work Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal No Work amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,legalnowork, Date_Start, Date_End, payrolldate, payrollpaytype, 11.4 AS Headersort,'Legal No Work Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholiday_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    12, 'Legal Holiday Hours', @uname, @guid
	FROM #FilteredSummary


	--'append Legal holiday amt
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholiday,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    13, 'Legal Holiday Amt', @uname, @guid
	FROM #FilteredSummary

	--'append Legal holiday hours2
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholiday2_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    13.1, 'Legal Holiday2 Hours', @uname, @guid
	FROM #FilteredSummary

	--'append Legal holiday amt2
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholiday2,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    13.2, 'Legal Holiday2 Amt', @uname, @guid
	FROM #FilteredSummary






	--'append Legal holiday OT HOURS
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholidayOT_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    14, 'Legal Holiday OT Hours', @uname, @guid
	FROM #FilteredSummary

	
	--'append Legal holiday OT amt	
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(legalholidayOT AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    15, 'Legal Holiday OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append Legal holiday nightdiff hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    legalholidayND_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    16, 'Legal Holiday ND Hours', @uname, @guid
	FROM #FilteredSummary


	--'append Legal holiday nightdiff amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(legalholidayND AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    17, 'Legal Holiday ND Amt', @uname, @guid
	FROM #FilteredSummary




	--'append Legal holiday nightdiff hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhotndh,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    17.1, 'Legal Holiday OTND Hours', @uname, @guid
	FROM #FilteredSummary


	--'append Legal holiday nightdiff amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(lhotnd AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    17.2, 'Legal Holiday OTND Amt', @uname, @guid
	FROM #FilteredSummary

	--'append Legal holiday OTND hours	
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,lhotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 17.1 AS Headersort, 'LH OT ND Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Legal holiday OTND amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(lhotnd AS DECIMAL(10,2)) AS lhotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 17.2 AS Headersort, 'LH OT ND Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    holiday_special_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    18, 'Special Holiday Hours', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(holiday_special AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    19, 'Special Holiday Amt', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday2 hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    specialholiday2_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    19.1, 'Special Holiday2 Hours', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday2 amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(specialholiday2 AS DECIMAL(10,2)) AS specialholiday2,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    19.2, 'Special Holiday2 Amt', @uname, @guid
	FROM #FilteredSummary




	--'append special holiday OT Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    holiday_specialOT_hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    20, 'Special Holiday OT Hours', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday OT Amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(holiday_specialOT AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    21, 'Special Holiday OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday ND hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    Holiday_SpecialND_Hours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    22, 'Special Holiday ND Hours', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday ND amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(Holiday_Specialnightdiff AS DECIMAL(10,2)),
    Date_Start, Date_End, payrolldate, payrollpaytype,
    23, 'Special Holiday ND Amt', @uname, @guid
	FROM #FilteredSummary



	--'append special holiday OTND hours
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,shotndh, Date_Start, Date_End, payrolldate, payrollpaytype, 23.1 AS Headersort, 'SH OT ND Hours' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append special holiday OTND amount
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(shotnd AS DECIMAL(10,2)) AS shotnd, Date_Start, Date_End, payrolldate, payrollpaytype, 23.2 AS Headersort, 'SH OT ND Amt' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append special holiday RDOT Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    SHONRDOThours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    24, 'SH Restday OT Hours', @uname, @guid
	FROM #FilteredSummary


	--'append special holiday RDOT amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(SHONRDOT AS DECIMAL(10,2)) AS SHONRDOT,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    25, 'SH Restday OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append legal holiday RDOT Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    LHONRDOThours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    25.1, 'LH Restday OT Hours', @uname, @guid
	FROM #FilteredSummary

	--'append legal holiday RDOT amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(LHONRDOT AS DECIMAL(10,2)) AS LHONRDOT,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    25.2, 'LH Restday OT Amt', @uname, @guid
	FROM #FilteredSummary


	--'append RD Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    rdhours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26, 'Restday Hours', @uname, @guid
	FROM #FilteredSummary


	--'append RD amount

	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(RD AS DECIMAL(10,2)) AS RD,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26.1, 'Restday Amt', @uname, @guid
	FROM #FilteredSummary



	--'append RDOT Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    rdothours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26.2, 'Restday OT Hours', @uname, @guid
	FROM #FilteredSummary


	--'append RDOT amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(RDot AS DECIMAL(10,2)) AS RDot,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26.3, 'Restday OT Amt', @uname, @guid
	FROM #FilteredSummary						 												 
	

	--'append RDND Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    rdndhours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26.4, 'Restday ND Hours', @uname, @guid
	FROM #FilteredSummary


	--'append RDND amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    rdnd,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    26.5, 'Restday ND Amt', @uname, @guid
	FROM #FilteredSummary
	 
	--'append WDO Hours
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    wdohours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    28, 'Working Dayoff Hours', @uname, @guid
	FROM #filteredsummary


	--'append WDO amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    wdo,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    29, 'Working Dayoff Amt', @uname, @guid
	FROM #FilteredSummary


	
	--'append LHWDOHOURS amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdohours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31, 'LHWDO Hours', @uname, @guid
	FROM #FilteredSummary
	
	--'append LHWDO amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdo,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.1, 'LHWDO', @uname, @guid
	FROM #FilteredSummary



	--'append LHWDOOTHOuRS amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdoothours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.2, 'LHWDOOT Hours', @uname, @guid
	FROM #FilteredSummary
	
	--'append LHWDOOT amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdoot,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.3, 'LHWDOOT', @uname, @guid
	FROM #FilteredSummary


	--'append LHWDONDHOuRS amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdondhours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.4, 'LHWDOND Hours', @uname, @guid
	FROM #FilteredSummary
	
	--'append LHWDOND amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdond,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.5, 'LHWDOND', @uname, @guid
	FROM #FilteredSummary


	
	--'append LHWDONDOTHOuRS amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdondothours,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.6, 'LHWDONDOT Hours', @uname, @guid
	FROM #FilteredSummary
	
	--'append LHWDONDOT amount
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    lhwdondot,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    31.7, 'LHWDONDOT', @uname, @guid
	FROM #FilteredSummary






	--'append Total OT
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    totalOT,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    40, 'Total OT', @uname, @guid
	FROM #filteredsummary

   --'append Total ND
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
   -- SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,nightdifftotal, Date_Start, Date_End, payrolldate, payrollpaytype, 40.1 AS Headersort, 'Total Night Diff' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment


	--'append Gross Salary assign value 200
	UNION ALL
	SELECT 
    idpayrollsum, Employee_id, fname2, lname2, mname2,
    idclientp, departmentdesc2, department_codep,
    CAST(grossalary AS DECIMAL(10,2)) AS grossalary,
    Date_Start, Date_End, payrolldate, payrollpaytype,
    200, 'Gross Amt', @uname, @guid
	FROM #filteredsummary


	--'append SSS plus Employer mandatory
	INSERT INTO payroll_summary2
    (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname, contributionSSSER, 
	contributionphilhealthER, contributionPagibigER, contributionSSSECC,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(contributionSSSEE AS DECIMAL(10, 2)) AS contributionsssee, Date_Start, Date_End, payrolldate, payrollpaytype, 
    201 AS Headersort, 'SSS' AS Headername, @uname AS uname, contributionSSSER, contributionphilhealthER, contributionPagibigER, contributionSSSECC,@guid
	FROM payroll_summary
	WHERE(idclientp = @idclient) AND (Date_Start = @datestart) AND (Date_End = @dateend) AND (department_codep = @iddepartment)

	--'append SSS PRo
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(contributionSSSEEpro AS DECIMAL(10,2)) as contributionssseepro, Date_Start, Date_End, payrolldate, payrollpaytype, 202 AS Headersort, 'SSS Pro' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment



	--'append philhealth
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(contributionphilhealthee AS DECIMAL(10,2)) as contributionphilhealthee , Date_Start, Date_End, payrolldate, payrollpaytype, 203 AS Headersort, 'PHILHEALTH' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment


	--'append pagibig
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,contributionpagibigee, Date_Start, Date_End, payrolldate, payrollpaytype, 204 AS Headersort, 'PagIbig' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment


	--'append wtax
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,wtax, Date_Start, Date_End, payrolldate, payrollpaytype, 205 AS Headersort, 'Withholding Tax' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment


	
	--'append total deduction
	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(totaldeduction AS DECIMAL(10,2)) as totaldeduction, Date_Start, Date_End, payrolldate, payrollpaytype, 9999 AS Headersort, 'Total Deduction' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart  AND (Date_End = @dateend) and department_codep= @iddepartment


	--'append Netamount

	INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
    SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount AS DECIMAL(10,2)) as netamount, Date_Start, Date_End, payrolldate, payrollpaytype, 10000 AS Headersort, 'Net Amount' AS Headername,@uname AS uname,@guid
    FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment


	--'append Netamount2 for payslip
	--INSERT INTO payroll_summary2 (IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname)
    --SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep,CAST(netamount2 AS DECIMAL(10,2)) as netamount2, Date_Start, Date_End, payrolldate, payrollpaytype, 10000.1 AS Headersort, 'Net Amount2' AS Headername,@uname AS uname
    --FROM payroll_summary
    --WHERE idclientp = @idclient AND date_start = @datestart and department_codep= @iddepartment



	--'append thirteenmonth
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(thirteenmonth AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11000 AS Headersort, '13th Month Cuttoff' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart and  (Date_End = @dateend) AND  department_codep= @iddepartment

	--'append thirteenmonth YTD
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(ytdthirteenmonth AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11100 AS Headersort, '13th Month YTD' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment

	--SILP per cuttoff
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(silp AS DECIMAL(10, 2)) AS thirteenmonth, Date_Start, Date_End, payrolldate, payrollpaytype, 
    11001 AS Headersort, 'SIL Cuttoff' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment

	--Allowance per cuttoff
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(allowancep AS DECIMAL(10, 2)) AS Allowance, Date_Start, Date_End, payrolldate, payrollpaytype, 
    50.18 AS Headersort, 'Allowance' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment

	 --Income Adjustment per cuttoff
	INSERT INTO payroll_summary2
	(IDpayrollsum, employee_id, fname, lname, mname, idclientp, departmentdesc2, department_codep, Amount, date_start, date_end, payrolldate, payrollpaytype, Headersort, Headername, uname,guid)
	SELECT idpayrollsum, Employee_id, fname2, lname2, mname2, idclientp, departmentdesc2, department_codep, CAST(incomeadjustmentp AS DECIMAL(10, 2)) AS incomeadjustment, Date_Start, Date_End, payrolldate, payrollpaytype, 
    50.01 AS Headersort, 'Income Adjustment' AS Headername, @uname AS uname,@guid
	FROM payroll_summary
    WHERE idclientp = @idclient AND date_start = @datestart AND (Date_End = @dateend) and department_codep= @iddepartment



             

-------------------------Payroll report  other dededuction Process -----------------------------------



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
DECLARE @newparticular varchar(50)
DECLARE @newcodeotherdeduction float 
 
     
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
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart AND (payroll_summary.Date_End = @dateend) and payroll_summary.department_codep= @iddepartment

	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idpayrollsum,@employeeid,@fname2,@lname2,@mname2,@idclientp2, @departmentdesc2,@department_codep,@payrollpaytype,@payrolldate,@Date_Start,@Date_end,@codeotherdeduction,@particular,@amount
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  		--update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@pidpayrollsum2
			
			SET @newparticular =
			 CASE  
				--WHEN @particular = 'SSS Loan' OR @particular = 'Pag-Ibig Loan' or @particular ='SSS Loan Calamity'  or @particular = 'Pag-Ibig Loan Calamiy' THEN
				WHEN @particular Like '%Loan%'  THEN
				
				@particular 
			 ELSE 
				'Other Deduction'
			 END;
				
			SET @newcodeotherdeduction = 
			CASE  
			WHEN @particular Like '%Loan%'  THEN
				@codeotherdeduction 
			 ELSE 
				252
			 END;



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
			,headername
			,guid) 
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
			,@newcodeotherdeduction
			,@newparticular
			,@guid)				   

						
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
					  WHERE payroll_summary.idclientp = @idclient AND payroll_summary.date_start = @datestart  AND payroll_summary.Date_End = @dateend

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
			,headername
			,guid) 
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
			,@Aparticular
			,@guid)				   

						
	FETCH NEXT FROM myCursor4 INTO  @Aidpayrollsum,@Aemployeeid,@Afname2,@Alname2,@Amname2,@Aidclientp2, @Adepartmentdesc2,@Adepartment_codep,@Apayrollpaytype,@Apayrolldate,@ADate_Start,@ADate_end,@Acodeadjustment,@Aparticular,@Aamount
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4
	   	 

		  -----------------------------------End Adjustment Process --------------------------------------------
		  		   		   		  			 	 	   

DECLARE @preparedby nvarchar(40)
SET @preparedby = (SELECT top 1 signprepared FROM client  WHERE idclient = @idclient) 
DECLARE @checkedby nvarchar(40)
SET @checkedby = (SELECT top 1 signchecked FROM client  WHERE idclient = @idclient)
DECLARE @approved nvarchar(40)
SET @approved = (SELECT top 1 signapproved FROM client  WHERE idclient = @idclient)
DECLARE @notedby nvarchar(40)
SET @notedby = (SELECT top 1 signnoted FROM client  WHERE idclient = @idclient)

update [payroll_summary2] 
set preparedby =@preparedby WHERE idclientp = @idclient
update [payroll_summary2]
set checkedby =@checkedby  WHERE idclientp = @idclient
update [payroll_summary2]
set approvedby =@approved  WHERE idclientp = @idclient
update [payroll_summary2]
set notedby =@notedby  WHERE idclientp = @idclient




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

 DROP TABLE #FilteredSummary;

	-- Clean it up:	
	--DELETE FROM payroll_summary2 
	--WHERE
	--idClientp = @idclient 
	--AND Guid = @guid
	--AND date_start = @Date_Start
		
END 

