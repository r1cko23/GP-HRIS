-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[sp_timekeepselectlist]
	-- Add the parameters for the stored procedure here
		@keytext varchar(50),
		@chkallclient bit,
		@iddepartment int,
		@idclient int,
		@datestart date,
		@chkcurrentclient bit,
		@chkcurrentclientdepartment bit
		
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	--- upon opening shows only previous employee cuttoff null keytext  
	IF (@keytext IS NULL OR  @keytext = '') and ((@chkcurrentclientdepartment = 'False') and ((@chkcurrentclient = 'False') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist per client per department
    BEGIN
		declare @previouscuttoff as date
		SET @previouscuttoff = DATEADD(DAY, -1, @datestart)		

		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			ps.employeeid,
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status,
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1,
			c.companyname,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			cbp.jobposition,
			cbp.dailyratepayroll,
			d.Department_desc,
			
		
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted,
			cbp.allowance,
			
			e.tagdelete
			

		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND ps.DateStart = @datestart  
			
		WHERE (e.department_code = @iddepartment) 
				AND	(cbp.idclient = @idclient) 
				AND (e.tagdelete = 'N') 
				AND	(ps.Employeeid IS NULL)
				AND (e.Employee_id IN
								(SELECT employeeid
								 FROM tbl_timekeep
								WHERE (idclient = @idclient ) AND (DateEnd = @previouscuttoff) AND (department_code = @iddepartment)))

								AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)



		ORDER BY e.lname, e.fname
	END


	--- upon opening shows only previous employee cuttoff <> null keytext  
	IF (@keytext IS NOT NULL OR @keytext <> '') and ((@chkcurrentclientdepartment = 'False') and ((@chkcurrentclient = 'False') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist per client per department
    BEGIN
		
		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status,
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1,
			c.companyname,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			cbp.jobposition,
			cbp.dailyratepayroll,
			d.Department_desc,
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted, 
			cbp.allowance,
			
			e.tagdelete

		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND ps.DateStart = @datestart  
			
		WHERE (e.department_code = @iddepartment) 
				AND	(cbp.idclient = @idclient) 
				AND (e.tagdelete = 'N')
				AND	(ps.Employeeid IS NULL)
				AND (e.lname LIKE '%' + @keytext + '%'  OR e.fname LIKE '%' + @keytext + '%') 

				AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)
				  
			--	AND (e.Employee_id IN
			--					(SELECT Employee_id
			--					FROM tbl_timekeep
			--					WHERE (idclientp = @idclient ) 
			--					AND (Date_End = @previouscuttoff) 
			--					AND (department_codep = @iddepartment)))										
		ORDER BY e.lname, e.fname
	END




	---  department all
	IF (@keytext IS NULL OR @keytext = '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'False') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist  per department
    
	BEGIN
		
	--	declare @previouscuttoff2 as date
	--	SET @previouscuttoff = DATEADD(DAY, -1, @datestart)		

		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status,
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			c.companyname,
			cbp.jobposition,
			cbp.dailyratepayroll,
			cbp.allowance,

			d.Department_desc,
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted 
		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND ps.DateStart = @datestart  
			
		WHERE (e.department_code = @iddepartment) 
				AND	(cbp.idclient = @idclient) 
				and e.status ='Active'
				AND (e.tagdelete = 'N') 
				AND	(ps.Employeeid IS NULL) 		
				
				AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)
		ORDER BY e.lname, e.fname
	END



	---  department all	<> null keytext
	IF (@keytext IS NOT NULL OR  @keytext <> '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'False') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist  per department
    
	BEGIN		
	
		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status,
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1,
			c.companyname,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			cbp.jobposition,
			cbp.dailyratepayroll,
			cbp.allowance,
			d.Department_desc,
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted 
		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND ps.DateStart = @datestart  
			
		WHERE (e.department_code = @iddepartment) 
				AND	(cbp.idclient = @idclient) 
				AND (e.tagdelete = 'N')
				--AND	(ps.Employeeid IS NULL)
				AND (e.lname LIKE '%' + @keytext + '%' or e.fname LIKE '%' + @keytext + '%' or cbp.jobposition LIKE '%' + @keytext + '%' )	
				AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)
				
		ORDER BY e.lname, e.fname
	END



---  Client all
	IF (@keytext IS NULL OR @keytext = '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'True') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist  per Client
    Begin
		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status, 
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1, 
			cbp.jobposition,  
			cbp.dailyratepayroll,
			cbp.allowance,
			d.Department_desc,		
			c.companyname,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted 
		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN	[GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN	[GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN 	[GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND ps.DateStart = @datestart
		
		WHERE(cbp.idclient = @idclient) 
			AND e.status = 'Active' 
			AND (e.tagdelete = 'N') 
			AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)
			--AND (ps.Employeeid IS NULL)
		ORDER BY e.lname, e.fname
	End


	---  Client all	keytext <> null 
	IF (@keytext IS NOT NULL OR @keytext <> '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'True') and (@chkallclient = 'False')))--null keytext and filter only not in the payrolllist  per Client
    Begin
		SELECT 
			e.department_code, 
			e.idclient, 
			e.Employee_id, 
			e.fname, 
			e.lname, 
			e.mname, 
			e.SSSno, 
			e.pagibigno, 
			e.philhealthno, 
			e.TINno, 
			e.status, 
			e.tagdelete, 
			e.tax_status, 
			e.departmentsub, 
			e.paythrough, 
			e.bankaccountno, 
			e.bankname,
			e.Position1, 
			cbp.jobposition,
			cbp.dailyratepayroll,
			cbp.allowance,
			d.Department_desc,		
			c.companyname,
			c.basisofsssded,
			c.basisofphilded,
			c.schedstatutory,
			c.signprepared,
			c.signchecked, 
			c.signapproved, 
			c.signnoted 
		FROM [GREENHRISMAIN].dbo.Employee AS e 
			INNER JOIN	[GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
			INNER JOIN	[GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
			INNER JOIN 	[GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
			LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND	e.idclient = ps.idclient AND 	ps.DateStart = @datestart
		
		WHERE(cbp.idclient = @idclient) 
			AND e.status = 'Active' 
			AND (e.tagdelete = 'N') 			
		--	AND (ps.Employeeid IS NULL) changed 4-20-2026 nova issue
			AND (e.lname LIKE '%' + @keytext + '%' or e.fname LIKE '%' + @keytext + '%' or cbp.jobposition LIKE '%' + @keytext + '%' )	
			AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)

		ORDER BY e.lname, e.fname
	End



	--- All	maximum 400
	IF (@keytext IS NULL OR @keytext = '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'True') and (@chkallclient = 'True'))) --All but llimited view
    Begin
	SELECT top 400     
		e.department_code, 
		e.idclient, e.Employee_id, 
		e.fname, 
		e.lname, 
		e.mname, 
		e.SSSno, 
		e.pagibigno, 
		e.philhealthno, 
		e.TINno, e.status, 
		e.tagdelete, 
		e.tax_status,
		e.departmentsub,              
		e.paythrough, 
		e.bankaccountno, 
		e.bankname,
		e.Position1,
		cbp.jobposition,
		cbp.dailyratepayroll,
		cbp.allowance,
		d.Department_desc,	
		c.companyname,
		c.basisofsssded,
		c.basisofphilded,
		c.schedstatutory,
		c.signprepared,
		c.signchecked, 
		c.signapproved, 
		c.signnoted 

	FROM [GREENHRISMAIN].dbo.Employee AS e 
		INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
		INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
		INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
		LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND e.idclient = ps.idclient AND ps.DateStart = @datestart
	
	WHERE (e.status = 'Active') 
		AND (e.tagdelete = 'N')	
		
		AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)

		ORDER BY e.lname, e.fname

	End



	--- All	maximum 400	 keytes <> ''
	IF (@keytext IS NOT NULL OR @keytext <> '') and ((@chkcurrentclientdepartment = 'True') and ((@chkcurrentclient = 'True') and (@chkallclient = 'True'))) --All but llimited view
    Begin
	SELECT top 400     
		e.department_code, 
		e.idclient, e.Employee_id, 
		e.fname, 
		e.lname, 
		e.mname, 
		e.SSSno, 
		e.pagibigno, 
		e.philhealthno, 
		e.TINno, e.status, 
		e.tagdelete, 
		e.tax_status,
		e.departmentsub,              
		e.paythrough, 
		e.bankaccountno, 
		e.bankname,
		e.Position1,
		cbp.jobposition, 
		cbp.dailyratepayroll,
		cbp.allowance,
		d.Department_desc,	
		c.companyname,
		c.basisofsssded,
		c.basisofphilded,
		c.schedstatutory,
		c.signprepared,
		c.signchecked, 
		c.signapproved, 
		c.signnoted 
	FROM [GREENHRISMAIN].dbo.Employee AS e 
		INNER JOIN [GREENHRISMAIN].dbo.client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
		INNER JOIN [GREENHRISMAIN].dbo.Department AS d ON e.department_code = d.iddepartment 
		INNER JOIN [GREENHRISMAIN].dbo.client AS c ON e.idclient = c.idclient 
		LEFT OUTER JOIN	tbl_timekeep AS ps ON e.Employee_id = ps.Employeeid AND e.idclient = ps.idclient AND ps.DateStart = @datestart
	
	WHERE (e.status = 'Active') 
		AND (e.tagdelete = 'N')
		
		AND (e.lname LIKE '%' + @keytext + '%' or e.fname LIKE '%' + @keytext + '%' or cbp.jobposition LIKE '%' + @keytext + '%' )	
		AND (
													e.verificationstatus IS NULL
													OR e.verificationstatus = 'Verified'
													)
		ORDER BY e.lname, e.fname

	End



	/*

	IF (@keytext Is Not NULL OR @keytext <> '') and ((@chkcurrentclient = 'True') AND (@chkallclient = 'True'))
  	 BEGIN
		SELECT top 200 e.department_code, e.idclient, e.Employee_id, e.fname, e.lname, e.mname, e.SSSno, e.pagibigno, e.philhealthno, e.TINno, e.status, e.tagdelete, e.tax_status, cbp.jobposition, e.Position1, d.Department_desc, 
		e.departmentsub, e.paythrough, e.bankaccountno, e.bankname, c.companyname
		FROM Employee AS e INNER JOIN
		client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition INNER JOIN
		Department AS d ON e.department_code = d.iddepartment INNER JOIN
		client AS c ON e.idclient = c.idclient
		WHERE (e.status = 'Active') 
		
		AND (e.tagdelete = 'N') 
		AND (e.fname LIKE '%' + @keytext + '%') OR	(e.status = 'Active') 
	
		AND (e.tagdelete = 'N') 
		AND (e.lname LIKE '%' + @keytext + '%') OR 	(e.status = 'Active') AND (e.tagdelete = 'N') 
		AND (cbp.jobposition LIKE '%' + @keytext + '%')
		
		ORDER BY e.lname, e.fname
	END
	*/
END
