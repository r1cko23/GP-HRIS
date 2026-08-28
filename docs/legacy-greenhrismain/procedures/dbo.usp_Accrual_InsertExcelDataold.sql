



-- ===========================================
-- Author:		Nianz
-- Create date: 18.Oct.2022 17:33
-- Description:	Insert record for Excel Acrual
-- ===========================================
CREATE PROCEDURE [dbo].[usp_Accrual_InsertExcelDataold]
	@Guid nvarchar(60)
	,@idClient int
	,@ClientName nvarchar(100)
	,@idDepartment int
	,@DepartmentDesc nvarchar(100)
	,@PayrollPeriodStart date
	,@PayrollPeriodEnd date
	,@PayrollDate date
	,@RecordNo int
	,@EmployeeId int
	,@Name nvarchar(150)
	,@Position nvarchar(100)
	,@Late_UT_Hours float
	,@Rate_Daily float
	,@Rate_Hourly float
	,@Regular_Days float
	,@Regular_Hours float
	,@Regular_OT float
	,@Regular_ND float
	,@Regular_NDOT float
	,@Legal_NoWork_Hours float
	,@LegalHoliday_Hours float
	,@LegalHoliday_OT float
	,@LegalHoliday_ND float
	,@LegalHoliday_NDOT float
	,@SpecialHoliday_Hours float
	,@SpecialHoliday_OT float
	,@SpecialHoliday_ND float
	,@SpecialHoliday_NDOT float
	,@RestDay_Hours float
	,@RestDay_Hours_SH_OT float
	,@RestDay_Hours_LH_OT float
	,@RestDay_Hours_WDO float
	,@CreatedBy nvarchar(50)
	 
AS
BEGIN
	DECLARE
		@DupsTag int
		,@ToolTipText nvarchar(255)

	-- RECORD EXCEPTION: Record will not be save! 
	SELECT @DupsTag = -1, @ToolTipText = 'No employee Id!' WHERE @EmployeeId = 0

	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		-- EmpId is not existing 
		SELECT @DupsTag = -1, @ToolTipText = 'Employee ID: ' + CAST(@EmployeeId AS VarChar(10)) + ' not found!' 
		WHERE (SELECT TOP 1 COUNT(Employee_Id) FROM Employee WHERE tagdelete = 'N' AND Employee_id = @EmployeeId) = 0
	END	
	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		-- Position is not existing on a given idClient
		SELECT @DupsTag = -1, @ToolTipText = 'Position not found on ' + @ClientName + ' - ' + @DepartmentDesc + '!' 
		WHERE (SELECT TOP 1 COUNT(jobposition) FROM client_branch_position WHERE jobposition = @Position AND idclient = @idClient) = 0
	END
	
	--IF (ISNULL(@DupsTag, 0) = 0)
	--BEGIN
		-- Duplicate entries, EmpNo/Position--
	--	SELECT @DupsTag = -1, @ToolTipText = 'Duplicate entry (Employee Id and Position)!' WHERE (SELECT TOP 1 COUNT(EmployeeId) FROM [dbo].[AccrualExcel] WHERE [Guid] = @Guid AND EmployeeId = @EmployeeId AND Position = @Position  AND @idDepartment NOT IN (99,98)) > 0  
	--END

	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		SELECT @DupsTag = -1, 
			@ToolTipText = 	(SELECT TOP 1 'Invalid Daily Rates, ' + @Position + '''s rate should be ' + CAST(dailyratepayroll AS VarChar(20)) FROM client_branch_position WHERE idclient = @idclient AND jobposition = @Position)
		WHERE 
			(SELECT COUNT(idbranchposition)
			FROM 
				client_branch_position
			WHERE
				idclient = @idclient 
				AND jobposition = @Position
				AND dailyratepayroll = @Rate_Daily 
			) = 0  
	END
	
	--BUDI's Color Coding:
	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		-- #1 - Reliver (With in Client Id & idDeparmant but different Position)
		SELECT @DupsTag = 1, @ToolTipText = 'Reliver as ' + @Position WHERE (SELECT TOP 1 COUNT(e.Employee_id) 
									FROM 
										[dbo].Employee e 
										INNER JOIN client_branch_position cbp ON cbp.idbranchposition = e.Position1
									WHERE e.Employee_id = @EmployeeId 
										AND e.tagdelete = 'N'
										AND e.idClient = @idClient
										AND e.department_code = @idDepartment
										AND cbp.jobposition <> @Position) > 0  
	END	
	
	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		-- #2 - Reliver (With in Client Id but different idDeparmant)
		SELECT @DupsTag = 2, 
		@ToolTipText = (SELECT TOP 1 'Reliver came from ' + @ClientName + ' - ' + d.Department_desc + ' (' + cbp.jobposition + ')' + ' as ' + @Position 
							FROM 
								[dbo].Employee e
								INNER JOIN client_branch_position cbp ON cbp.idbranchposition = e.Position1
								INNER JOIN Department d ON d.iddepartment = e.department_code 
							WHERE 
								e.Employee_id = @EmployeeId
								AND e.tagdelete = 'N'

						)
		WHERE (SELECT TOP 1 COUNT(e.Employee_id) 
									FROM 
										[dbo].Employee e 
										INNER JOIN client_branch_position cbp ON cbp.idbranchposition = e.Position1
									WHERE e.Employee_id = @EmployeeId
										AND e.tagdelete = 'N'
										AND e.idClient = @idClient 
										AND e.department_code <> @idDepartment) > 0  
	END

	IF (@DupsTag = 2)
	BEGIN
		-- #3 - Reliver (With in Client Id but different idDeparmant and with multiple positions)
		SELECT @DupsTag = 3 WHERE (SELECT TOP 1 COUNT(ae.EmployeeId) 
									FROM 
										[dbo].AccrualExcel ae 
									WHERE
										[Guid] = @Guid AND ae.EmployeeId = @EmployeeId 
										AND ae.idClient = @idClient 
										AND ae.idDepartment = @idDepartment
										AND ae.Position <> @Position) > 0  
	END

	IF (ISNULL(@DupsTag, 0) = 0)
	BEGIN
		-- #4 - Reliver from other Client Id
		SELECT @DupsTag = 4, 
		@ToolTipText = (SELECT TOP 1 'Reliver came from ' + c.companyname + ' - ' + d.Department_desc + ' (' + cbp.jobposition + ')' + ' as ' + @Position 
							FROM 
								[dbo].Employee e
								INNER JOIN client_branch_position cbp ON cbp.idbranchposition = e.Position1
								INNER JOIN client c ON c.idclient = e.idclient
								INNER JOIN Department d ON d.iddepartment = e.department_code 
							WHERE 
								e.Employee_id = @EmployeeId 
								AND e.tagdelete = 'N'
						)
		WHERE (SELECT TOP 1 COUNT(e.Employee_id) 
									FROM 
										[dbo].Employee e 
									WHERE e.Employee_id = @EmployeeId
										AND e.tagdelete = 'N'
										AND e.idClient <> @idClient) > 0  
	END

	IF (@DupsTag = 4)
	BEGIN
		-- #5 - Reliver from other Client Id with multiple positions
		SELECT @DupsTag = 5 WHERE (SELECT TOP 1 COUNT(ae.EmployeeId) 
									FROM 
										[dbo].AccrualExcel ae 
									WHERE
										[Guid] = @Guid AND ae.EmployeeId = @EmployeeId 
										AND ae.idClient = @idClient 
										AND ae.idDepartment = @idDepartment
										AND ae.Position <> @Position) > 0
	END

	INSERT INTO [dbo].[AccrualExcel]
		([Guid]
		,[idClient]
		,[ClientName]
		,[idDepartment]
		,[DepartmentDesc]
		,[PayrollPeriodStart]
		,[PayrollPeriodEnd]
		,[PayrollDate]
		,[RecordNo]
		,[EmployeeId]
		,[Name]
		,[Position]
		,[Late_UT_Hours]
		,[Rate_Daily]
		,[Rate_Hourly]
		,[Regular_Days]
		,[Regular_Hours]
		,[Regular_OT]
		,[Regular_ND]
		,[Regular_NDOT]
		,[Legal_NoWork_Hours]
		,[LegalHoliday_Hours]
		,[LegalHoliday_OT]
		,[LegalHoliday_ND]
		,[LegalHoliday_NDOT]
		,[SpecialHoliday_Hours]
		,[SpecialHoliday_OT]
		,[SpecialHoliday_ND]
		,[SpecialHoliday_NDOT]
		,[RestDay_Hours]
		,[RestDay_Hours_SH_OT]
		,[RestDay_Hours_LH_OT]
		,[RestDay_Hours_WDO]
		,[DupsTag]
		,[ToolTipText]
		,[CreatedBy]
		,[CreatedAt])
	VALUES
		(@Guid
		,@idClient
		,@ClientName
		,@idDepartment
		,@DepartmentDesc
		,@PayrollPeriodStart
		,@PayrollPeriodEnd
		,@PayrollDate
		,@RecordNo
		,@EmployeeId
		,@Name
		,@Position
		,@Late_UT_Hours
		,@Rate_Daily
		,@Rate_Hourly
		,@Regular_Days
		,@Regular_Hours
		,@Regular_OT
		,@Regular_ND
		,@Regular_NDOT
		,@Legal_NoWork_Hours
		,@LegalHoliday_Hours
		,@LegalHoliday_OT
		,@LegalHoliday_ND
		,@LegalHoliday_NDOT
		,@SpecialHoliday_Hours
		,@SpecialHoliday_OT
		,@SpecialHoliday_ND
		,@SpecialHoliday_NDOT
		,@RestDay_Hours
		,@RestDay_Hours_SH_OT
		,@RestDay_Hours_LH_OT
		,@RestDay_Hours_WDO
		,@DupsTag
		,@ToolTipText
		,@CreatedBy
		,GETDATE())
END
